import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { parseOverviewRow, formatExecutionTime } from '../utils/transform';

const router = Router();

router.get('/overview', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const result = await pool.query(`
      SELECT
        study_id,
        study_name,
        study_phase,
        COUNT(DISTINCT participant_id)  AS participant_count,
        COUNT(*)                        AS total_measurements,
        COUNT(DISTINCT site_id)         AS site_count
      FROM clinical_data_raw
      GROUP BY study_id, study_name, study_phase
      ORDER BY study_id
    `);

    const data = result.rows.map(parseOverviewRow);
    const executionTime = Date.now() - startTime;

    res.json({ data, ...formatExecutionTime(executionTime) });
  } catch (error) {
    console.error('Error fetching study overview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
