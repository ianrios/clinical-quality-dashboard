import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/distribution', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const result = await pool.query(`
      SELECT
        study_id,
        study_name,
        COUNT(*)                                                        AS total_measurements,
        AVG(quality_score::numeric)                                     AS avg_quality_score,
        COUNT(*) FILTER (WHERE quality_score::numeric >= 0.9)          AS high_quality_count,
        COUNT(*) FILTER (WHERE quality_score::numeric < 0.8)           AS low_quality_count
      FROM clinical_data_raw
      GROUP BY study_id, study_name
      ORDER BY study_id
    `);

    const data = result.rows.map(row => ({
      study_id: row.study_id,
      study_name: row.study_name,
      total_measurements: parseInt(row.total_measurements),
      avg_quality_score: parseFloat(row.avg_quality_score),
      high_quality_count: parseInt(row.high_quality_count),
      low_quality_count: parseInt(row.low_quality_count)
    }));

    const executionTime = Date.now() - startTime;

    res.json({
      data,
      executionTime: `${executionTime}ms`,
      executionTimeSeconds: (executionTime / 1000).toFixed(2)
    });
  } catch (error) {
    console.error('Error fetching quality distribution:', error);
    res.status(500).json({
      error: 'Failed to fetch quality distribution',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
