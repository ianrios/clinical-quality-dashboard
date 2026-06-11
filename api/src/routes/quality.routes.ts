import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { parseQualityRow, formatExecutionTime } from '../utils/transform';

const router = Router();

router.get('/distribution', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const result = await pool.query(`
      SELECT
        study_id,
        study_name,
        COUNT(*)                                          AS total_measurements,
        AVG(quality_score)                               AS avg_quality_score,
        COUNT(*) FILTER (WHERE quality_score >= 0.9)     AS high_quality_count,
        COUNT(*) FILTER (WHERE quality_score < 0.8)      AS low_quality_count
      FROM clinical_data_raw
      GROUP BY study_id, study_name
      ORDER BY study_id
    `);

    const data = result.rows.map(parseQualityRow);
    const executionTime = Date.now() - startTime;

    res.json({ data, ...formatExecutionTime(executionTime) });
  } catch (error) {
    console.error('Error fetching quality distribution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
