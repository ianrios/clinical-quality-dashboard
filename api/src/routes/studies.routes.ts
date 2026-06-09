import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { parseOverviewRow, formatExecutionTime } from '../utils/transform';

const router = Router();

router.get('/list', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const result = await pool.query(`
      SELECT DISTINCT study_id, study_name, study_phase
      FROM clinical_data_raw
      ORDER BY study_id
    `);

    const executionTime = Date.now() - startTime;

    res.json({ data: result.rows, ...formatExecutionTime(executionTime) });
  } catch (error) {
    console.error('Error fetching study list:', error);
    res.status(500).json({
      error: 'Failed to fetch study list',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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
    res.status(500).json({
      error: 'Failed to fetch study overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
