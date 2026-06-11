import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { parseParticipantSummaryRow, parseEnrollmentRow, parseParticipantDetailRow, formatExecutionTime } from '../utils/transform';

const router = Router();

// ─── GET /summary ─────────────────────────────────────────────────────────────

router.get('/summary', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const studyId = (req.query.study as string | undefined) || null;
  const siteId = (req.query.site as string | undefined) || null;

  try {
    const result = await pool.query(`
      WITH participant_data AS (
        -- One row per participant. Carries study metadata so downstream CTEs avoid a second scan.
        SELECT
          study_id,
          MAX(study_name)             AS study_name,
          MAX(study_phase)            AS study_phase,
          participant_id,
          MAX(participant_dob)        AS participant_dob,
          MAX(participant_gender)     AS participant_gender,
          MAX(site_id)                AS site_id,
          MAX(site_name)              AS site_name,
          COUNT(*)                    AS measurement_count,
          MIN(measurement_timestamp)  AS first_measurement,
          MAX(measurement_timestamp)  AS last_measurement
        FROM clinical_data_raw
        WHERE ($1::text IS NULL OR study_id = $1)
          AND ($2::text IS NULL OR site_id = $2)
        GROUP BY study_id, participant_id
      ),
      participant_stats AS (
        SELECT
          study_id,
          COUNT(*)                                                                                        AS participant_count,
          AVG(age_years)                                                                                  AS avg_age,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY age_years)                                         AS median_age,
          MODE()               WITHIN GROUP (ORDER BY FLOOR(age_years)::int)                             AS mode_age,
          MIN(age_years)::int                                                                             AS min_age,
          MAX(age_years)::int                                                                             AS max_age,
          COUNT(*) FILTER (WHERE LOWER(participant_gender) = 'male')                                     AS male_count,
          COUNT(*) FILTER (WHERE LOWER(participant_gender) = 'female')                                   AS female_count,
          COUNT(DISTINCT site_id)                                                                         AS site_count,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY measurement_count)                                 AS median_measurements,
          MODE()               WITHIN GROUP (ORDER BY measurement_count::int)                            AS mode_measurements
        FROM (
          SELECT *, EXTRACT(YEAR FROM AGE(CURRENT_DATE, participant_dob)) AS age_years
          FROM participant_data
        ) pd
        GROUP BY study_id
      ),
      site_distribution AS (
        SELECT
          study_id,
          json_agg(
            json_build_object(
              'site_id',              site_id,
              'site_name',            site_name,
              'participant_count',    cnt,
              'male_count',           male_cnt,
              'female_count',         female_cnt,
              'avg_age',              ROUND(site_avg_age::numeric, 1),
              'min_age',              site_min_age,
              'max_age',              site_max_age,
              'avg_measurements',     ROUND((total_meas::numeric / cnt::numeric), 1),
              'earliest_measurement', site_earliest,
              'latest_measurement',   site_latest
            ) ORDER BY cnt DESC
          ) AS sites
        FROM (
          SELECT
            study_id, site_id, site_name,
            COUNT(*)                                                                      AS cnt,
            COUNT(*) FILTER (WHERE LOWER(participant_gender) = 'male')                   AS male_cnt,
            COUNT(*) FILTER (WHERE LOWER(participant_gender) = 'female')                 AS female_cnt,
            AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, participant_dob)))                   AS site_avg_age,
            MIN(EXTRACT(YEAR FROM AGE(CURRENT_DATE, participant_dob)))::int              AS site_min_age,
            MAX(EXTRACT(YEAR FROM AGE(CURRENT_DATE, participant_dob)))::int              AS site_max_age,
            SUM(measurement_count)                                                       AS total_meas,
            MIN(first_measurement)                                                       AS site_earliest,
            MAX(last_measurement)                                                        AS site_latest
          FROM participant_data
          GROUP BY study_id, site_id, site_name
        ) s
        GROUP BY study_id
      ),
      measurement_stats AS (
        SELECT
          study_id,
          MIN(first_measurement) AS earliest_measurement,
          MAX(last_measurement)  AS latest_measurement,
          SUM(measurement_count) AS total_measurements
        FROM participant_data
        GROUP BY study_id
      ),
      study_info AS (
        -- Derived from participant_data — no second scan of clinical_data_raw needed.
        SELECT study_id, MAX(study_name) AS study_name, MAX(study_phase) AS study_phase
        FROM participant_data
        GROUP BY study_id
      )
      SELECT
        si.study_id,
        si.study_name,
        si.study_phase,
        ps.participant_count,
        ps.avg_age,
        ps.median_age,
        ps.mode_age,
        ps.min_age,
        ps.max_age,
        ps.male_count,
        ps.female_count,
        ps.site_count,
        sd.sites,
        (ms.total_measurements::numeric / ps.participant_count::numeric)  AS avg_measurements_per_participant,
        ps.median_measurements                                             AS median_measurements_per_participant,
        ps.mode_measurements                                               AS mode_measurements_per_participant,
        ms.earliest_measurement,
        ms.latest_measurement
      FROM study_info si
      JOIN participant_stats  ps ON si.study_id = ps.study_id
      JOIN site_distribution  sd ON si.study_id = sd.study_id
      JOIN measurement_stats  ms ON si.study_id = ms.study_id
      ORDER BY si.study_id
    `, [studyId, siteId]);

    const data = result.rows.map(parseParticipantSummaryRow);
    const executionTime = Date.now() - startTime;
    res.json({ data, ...formatExecutionTime(executionTime) });
  } catch (error) {
    console.error('Error fetching participant summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /enrollment ──────────────────────────────────────────────────────────

router.get('/enrollment', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const studyId = (req.query.study as string | undefined) || null;

  try {
    const result = await pool.query(`
      WITH first_seen AS (
        SELECT study_id, participant_id, MIN(measurement_timestamp) AS first_ts
        FROM clinical_data_raw
        WHERE ($1::text IS NULL OR study_id = $1)
        GROUP BY study_id, participant_id
      )
      SELECT
        study_id,
        TO_CHAR(first_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS period,
        COUNT(*)::text                                       AS count
      FROM first_seen
      GROUP BY study_id, TO_CHAR(first_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ORDER BY study_id, period
    `, [studyId]);

    const data = result.rows.map(parseEnrollmentRow);
    const executionTime = Date.now() - startTime;
    res.json({ data, ...formatExecutionTime(executionTime) });
  } catch (error) {
    console.error('Error fetching enrollment trend:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /list ────────────────────────────────────────────────────────────────

router.get('/list', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const studyId = req.query.study as string;
  const siteId = (req.query.site as string | undefined) || null;
  const rawLimit = parseInt(req.query.limit as string || '25', 10);
  const rawOffset = parseInt(req.query.offset as string || '0', 10);

  if (!studyId) {
    return res.status(400).json({ error: 'study param is required' });
  }
  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    return res.status(400).json({ error: 'limit must be a positive integer' });
  }
  if (!Number.isInteger(rawOffset) || rawOffset < 0) {
    return res.status(400).json({ error: 'offset must be a non-negative integer' });
  }

  const limit = Math.min(rawLimit, 100);
  const offset = rawOffset;

  try {
    const [dataResult, countResult] = await Promise.all([
      pool.query(`
        SELECT
          participant_id,
          MAX(participant_gender)                                                  AS participant_gender,
          MAX(site_id)                                                             AS site_id,
          MAX(site_name)                                                           AS site_name,
          FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, MAX(participant_dob))))::text AS age,
          COUNT(*)::text                                                           AS measurement_count
        FROM clinical_data_raw
        WHERE study_id = $1
          AND ($2::text IS NULL OR site_id = $2)
        GROUP BY participant_id
        ORDER BY participant_id
        LIMIT $3 OFFSET $4
      `, [studyId, siteId, limit, offset]),
      pool.query(`
        SELECT COUNT(DISTINCT participant_id)::text AS total
        FROM clinical_data_raw
        WHERE study_id = $1
          AND ($2::text IS NULL OR site_id = $2)
      `, [studyId, siteId]),
    ]);

    const data = dataResult.rows.map(parseParticipantDetailRow);
    const total = parseInt(countResult.rows[0].total, 10);
    const executionTime = Date.now() - startTime;
    res.json({ data, total, ...formatExecutionTime(executionTime) });
  } catch (error) {
    console.error('Error fetching participant list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
