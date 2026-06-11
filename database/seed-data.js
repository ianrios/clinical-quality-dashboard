const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/clinical_data';

// Configuration
const STUDIES = [
  { id: 'CARDIO001', name: 'Cardiovascular Health Study', start: '2022-01-15', phase: 'Phase 3' },
  { id: 'DIABETES002', name: 'Diabetes Management Trial', start: '2022-03-20', phase: 'Phase 2' },
  { id: 'ONCOLOGY003', name: 'Cancer Treatment Study', start: '2021-11-01', phase: 'Phase 3' },
  { id: 'NEURO004', name: 'Neurological Disorders Research', start: '2022-06-10', phase: 'Phase 2' },
  { id: 'CARDIO005', name: 'Heart Failure Prevention Study', start: '2023-02-01', phase: 'Phase 1' }
];

const SITES = [
  { id: 'SITE_NY01', name: 'New York Medical Center', location: 'New York, NY', coordinator: 'Dr. Sarah Johnson' },
  { id: 'SITE_CA01', name: 'California Research Institute', location: 'San Francisco, CA', coordinator: 'Dr. Michael Chen' },
  { id: 'SITE_TX01', name: 'Texas Health Research', location: 'Houston, TX', coordinator: 'Dr. Emily Rodriguez' },
  { id: 'SITE_FL01', name: 'Florida Clinical Trials', location: 'Miami, FL', coordinator: 'Dr. James Williams' },
  { id: 'SITE_MA01', name: 'Massachusetts General Hospital', location: 'Boston, MA', coordinator: 'Dr. Linda Brown' },
  { id: 'SITE_IL01', name: 'Chicago Medical Research', location: 'Chicago, IL', coordinator: 'Dr. Robert Davis' },
  { id: 'SITE_WA01', name: 'Seattle Research Center', location: 'Seattle, WA', coordinator: 'Dr. Jennifer Lee' },
  { id: 'SITE_PA01', name: 'Philadelphia Health Institute', location: 'Philadelphia, PA', coordinator: 'Dr. David Martinez' }
];

const MEASUREMENT_TYPES = [
  { type: 'glucose', unit: 'mg/dL', min: 70, max: 200 },
  { type: 'blood_pressure', unit: 'mmHg', min: 90, max: 180 },
  { type: 'weight', unit: 'kg', min: 45, max: 120 },
  { type: 'heart_rate', unit: 'bpm', min: 50, max: 120 },
  { type: 'cholesterol', unit: 'mg/dL', min: 120, max: 280 },
  { type: 'bmi', unit: 'kg/m²', min: 16, max: 45 }
];

const FIRST_NAMES = ['John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Robert', 'Linda', 'James', 'Jennifer',
  'William', 'Patricia', 'Richard', 'Maria', 'Thomas', 'Nancy', 'Charles', 'Lisa', 'Daniel', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 1) {
  return (Math.random() * (max - min) + min).toFixed(decimals);
}

function randomElement(arr) {
  return arr[random(0, arr.length - 1)];
}

function generateDate(startYear, endYear) {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear, 11, 31);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function generateParticipant(study, siteIndex, participantIndex) {
  const site = SITES[siteIndex % SITES.length];
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  const participantId = `${study.id}_P${String(participantIndex).padStart(4, '0')}`;

  const age = random(25, 75);
  const birthYear = new Date().getFullYear() - age;
  const dob = generateDate(birthYear, birthYear);

  return {
    id: participantId,
    name: `${firstName} ${lastName}`,
    dob: formatDate(dob),
    gender: random(0, 1) === 0 ? 'Male' : 'Female',
    enrollmentDate: formatDate(generateDate(2022, 2024)),
    site
  };
}

function generateMeasurement(study, participant, measurementType, timestamp) {
  let value;

  if (measurementType.type === 'blood_pressure') {
    const systolic = random(measurementType.min, measurementType.max);
    const diastolic = random(60, 100);
    value = `${systolic}/${diastolic}`;
  } else {
    value = randomFloat(measurementType.min, measurementType.max, 1);
  }

  // Quality score: mostly high quality (0.8-1.0), but some poor quality (0.6-0.8)
  const qualityScore = random(0, 100) < 85 ? randomFloat(0.85, 1.0, 2) : randomFloat(0.6, 0.85, 2);

  // Quality flags: occasionally add flags for low quality
  const qualityFlags = parseFloat(qualityScore) < 0.8 ?
    randomElement(['incomplete_data', 'equipment_error', 'patient_movement', null]) : null;

  return {
    type: measurementType.type,
    value,
    unit: measurementType.unit,
    timestamp: timestamp.toISOString(),
    qualityScore,
    qualityFlags
  };
}

async function seedDatabase() {
  console.log('Starting database seeding...');
  console.log(`Connecting to: ${DATABASE_URL}`);

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database');

    const existing = await client.query('SELECT COUNT(*) as count FROM clinical_data_raw');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log(`Database already contains ${existing.rows[0].count} rows. Skipping seed.`);
      return;
    }

    // Target: ~500K rows (adjustable by changing participants per study or measurements per participant)
    const PARTICIPANTS_PER_STUDY = 1000; // 5 studies x 1000 = 5000 participants
    const MEASUREMENTS_PER_PARTICIPANT = 100; // 5000 x 100 = 500,000 measurements

    let totalRows = 0;
    const BATCH_SIZE = 2000;
    let batch = [];

    console.log(`Target: ~${STUDIES.length * PARTICIPANTS_PER_STUDY * MEASUREMENTS_PER_PARTICIPANT} total measurements`);
    console.log('');

    for (const study of STUDIES) {
      console.log(`Processing study: ${study.name} (${study.id})`);

      for (let p = 0; p < PARTICIPANTS_PER_STUDY; p++) {
        const participant = generateParticipant(study, p, p + 1);

        // Generate measurements spread over time
        for (let m = 0; m < MEASUREMENTS_PER_PARTICIPANT; m++) {
          const measurementType = MEASUREMENT_TYPES[m % MEASUREMENT_TYPES.length];
          const timestamp = generateDate(2022, 2024);
          const measurement = generateMeasurement(study, participant, measurementType, timestamp);

          batch.push([
            study.id,
            study.name,
            study.start,
            study.phase,
            participant.id,
            participant.dob,
            participant.gender,
            participant.enrollmentDate,
            participant.site.id,
            participant.site.name,
            participant.site.location,
            participant.site.coordinator,
            measurement.type,
            measurement.value,
            measurement.unit,
            measurement.timestamp,
            measurement.qualityScore,
            measurement.qualityFlags
          ]);

          totalRows++;

          // Insert batch when full
          if (batch.length >= BATCH_SIZE) {
            await insertBatch(client, batch);
            console.log(`  Inserted ${totalRows} rows...`);
            batch = [];
          }
        }
      }
    }

    // Insert remaining rows
    if (batch.length > 0) {
      await insertBatch(client, batch);
      console.log(`  Inserted ${totalRows} rows...`);
    }

    console.log('');
    console.log(`✓ Seeding complete! Total rows inserted: ${totalRows}`);
    console.log('');

    // Show some statistics
    const result = await client.query('SELECT COUNT(*) as count FROM clinical_data_raw');
    console.log(`Database now contains: ${result.rows[0].count} rows`);

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function insertBatch(client, batch) {
  const values = batch.map((row, i) => {
    const offset = i * 18;
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18})`;
  }).join(',');

  const query = `
    INSERT INTO clinical_data_raw (
      study_id, study_name, study_start_date, study_phase,
      participant_id, participant_dob, participant_gender, participant_enrollment_date,
      site_id, site_name, site_location, site_coordinator,
      measurement_type, measurement_value, measurement_unit, measurement_timestamp,
      quality_score, quality_flags
    ) VALUES ${values}
  `;

  await client.query(query, batch.flat());
}

seedDatabase();
