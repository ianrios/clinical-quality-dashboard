import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/overview', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const studiesQuery = `
      SELECT DISTINCT study_id, study_name, study_phase
      FROM clinical_data_raw
      ORDER BY study_id
    `;
    const studiesResult = await pool.query(studiesQuery);

    const data = [];
    for (const study of studiesResult.rows) {
      const participantQuery = `
        SELECT COUNT(DISTINCT participant_id) as participant_count
        FROM clinical_data_raw
        WHERE study_id = '${study.study_id}'
      `;
      const participantResult = await pool.query(participantQuery);

      const measurementQuery = `
        SELECT COUNT(*) as total_measurements
        FROM clinical_data_raw
        WHERE study_id = '${study.study_id}'
      `;
      const measurementResult = await pool.query(measurementQuery);

      const siteQuery = `
        SELECT COUNT(DISTINCT site_id) as site_count
        FROM clinical_data_raw
        WHERE study_id = '${study.study_id}'
      `;
      const siteResult = await pool.query(siteQuery);

      data.push({
        study_id: study.study_id,
        study_name: study.study_name,
        study_phase: study.study_phase,
        participant_count: parseInt(participantResult.rows[0].participant_count),
        total_measurements: parseInt(measurementResult.rows[0].total_measurements),
        site_count: parseInt(siteResult.rows[0].site_count)
      });
    }

    const executionTime = Date.now() - startTime;

    res.json({
      data,
      executionTime: `${executionTime}ms`,
      executionTimeSeconds: (executionTime / 1000).toFixed(2)
    });
  } catch (error) {
    console.error('Error fetching study overview:', error);
    res.status(500).json({
      error: 'Failed to fetch study overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
