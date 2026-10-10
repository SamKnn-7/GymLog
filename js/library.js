'use strict';

const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];
// Everything an exercise can be filed under: the muscle groups plus cardio
const CATEGORIES = [...MUSCLES, 'Cardio'];
const EQUIPMENT = ['Barbell', 'Dumbbell', 'Smith machine', 'Machine', 'Cable', 'Calisthenics'];

// Built-in exercises: [name, category, equipment, kind]
// kind 'hold' is logged as a time instead of weight and reps. Anything under
// Cardio is logged as a time plus an optional distance.
const EXERCISE_LIBRARY = [
  // --- Chest ---
  ['Bench press', 'Chest', 'Barbell'],
  ['Incline bench press', 'Chest', 'Barbell'],
  ['Decline bench press', 'Chest', 'Barbell'],
  ['Floor press', 'Chest', 'Barbell'],
  ['Dumbbell bench press', 'Chest', 'Dumbbell'],
  ['Incline dumbbell press', 'Chest', 'Dumbbell'],
  ['Decline dumbbell press', 'Chest', 'Dumbbell'],
  ['Chest fly', 'Chest', 'Dumbbell'],
  ['Incline dumbbell fly', 'Chest', 'Dumbbell'],
  ['Dumbbell pullover', 'Chest', 'Dumbbell'],
  ['Cable crossover', 'Chest', 'Cable'],
  ['Low cable fly', 'Chest', 'Cable'],
  ['Machine chest press', 'Chest', 'Machine'],
  ['Incline machine press', 'Chest', 'Machine'],
  ['Pec deck', 'Chest', 'Machine'],
  ['Smith machine bench press', 'Chest', 'Smith machine'],
  ['Smith machine incline bench press', 'Chest', 'Smith machine'],
  ['Smith machine decline bench press', 'Chest', 'Smith machine'],
  ['Smith machine floor press', 'Chest', 'Smith machine'],
  ['Smith machine guillotine press', 'Chest', 'Smith machine'],
  ['Push-ups', 'Chest', 'Calisthenics'],
  ['Wide push-ups', 'Chest', 'Calisthenics'],
  ['Incline push-ups', 'Chest', 'Calisthenics'],
  ['Decline push-ups', 'Chest', 'Calisthenics'],
  ['Archer push-ups', 'Chest', 'Calisthenics'],
  ['Clap push-ups', 'Chest', 'Calisthenics'],
  ['Pseudo planche push-ups', 'Chest', 'Calisthenics'],
  ['Dips', 'Chest', 'Calisthenics'],
  ['Ring dips', 'Chest', 'Calisthenics'],

  // --- Back ---
  ['Deadlift', 'Back', 'Barbell'],
  ['Barbell row', 'Back', 'Barbell'],
  ['Pendlay row', 'Back', 'Barbell'],
  ['T-bar row', 'Back', 'Barbell'],
  ['Rack pull', 'Back', 'Barbell'],
  ['Barbell shrug', 'Back', 'Barbell'],
  ['Dumbbell row', 'Back', 'Dumbbell'],
  ['Chest-supported dumbbell row', 'Back', 'Dumbbell'],
  ['Shrug', 'Back', 'Dumbbell'],
  ['Seated cable row', 'Back', 'Cable'],
  ['Lat pulldown', 'Back', 'Cable'],
  ['Close-grip lat pulldown', 'Back', 'Cable'],
  ['Straight-arm pulldown', 'Back', 'Cable'],
  ['Machine row', 'Back', 'Machine'],
  ['Assisted pull-up machine', 'Back', 'Machine'],
  ['Smith machine bent-over row', 'Back', 'Smith machine'],
  ['Smith machine deadlift', 'Back', 'Smith machine'],
  ['Smith machine rack pull', 'Back', 'Smith machine'],
  ['Smith machine shrug', 'Back', 'Smith machine'],
  ['Smith machine inverted row', 'Back', 'Smith machine'],
  ['Pull-ups', 'Back', 'Calisthenics'],
  ['Chin-ups', 'Back', 'Calisthenics'],
  ['Wide-grip pull-ups', 'Back', 'Calisthenics'],
  ['Neutral-grip pull-ups', 'Back', 'Calisthenics'],
  ['Inverted rows', 'Back', 'Calisthenics'],
  ['Scapular pull-ups', 'Back', 'Calisthenics'],
  ['Muscle-ups', 'Back', 'Calisthenics'],
  ['Back extension', 'Back', 'Calisthenics'],
  ['Superman', 'Back', 'Calisthenics'],
  ['Dead hang', 'Back', 'Calisthenics', 'hold'],
  ['Front lever hold', 'Back', 'Calisthenics', 'hold'],

  // --- Shoulders ---
  ['Overhead press', 'Shoulders', 'Barbell'],
  ['Push press', 'Shoulders', 'Barbell'],
  ['Upright row', 'Shoulders', 'Barbell'],
  ['Dumbbell shoulder press', 'Shoulders', 'Dumbbell'],
  ['Arnold press', 'Shoulders', 'Dumbbell'],
  ['Lateral raise', 'Shoulders', 'Dumbbell'],
  ['Front raise', 'Shoulders', 'Dumbbell'],
  ['Rear delt fly', 'Shoulders', 'Dumbbell'],
  ['Cable lateral raise', 'Shoulders', 'Cable'],
  ['Face pull', 'Shoulders', 'Cable'],
  ['Machine shoulder press', 'Shoulders', 'Machine'],
  ['Reverse pec deck', 'Shoulders', 'Machine'],
  ['Smith machine overhead press', 'Shoulders', 'Smith machine'],
  ['Smith machine seated shoulder press', 'Shoulders', 'Smith machine'],
  ['Smith machine behind-the-neck press', 'Shoulders', 'Smith machine'],
  ['Smith machine upright row', 'Shoulders', 'Smith machine'],
  ['Pike push-ups', 'Shoulders', 'Calisthenics'],
  ['Handstand push-ups', 'Shoulders', 'Calisthenics'],
  ['Handstand hold', 'Shoulders', 'Calisthenics', 'hold'],

  // --- Biceps ---
  ['Barbell curl', 'Biceps', 'Barbell'],
  ['EZ-bar curl', 'Biceps', 'Barbell'],
  ['Preacher curl', 'Biceps', 'Barbell'],
  ['Dumbbell curl', 'Biceps', 'Dumbbell'],
  ['Hammer curl', 'Biceps', 'Dumbbell'],
  ['Incline dumbbell curl', 'Biceps', 'Dumbbell'],
  ['Concentration curl', 'Biceps', 'Dumbbell'],
  ['Cable curl', 'Biceps', 'Cable'],
  ['Machine curl', 'Biceps', 'Machine'],
  ['Smith machine drag curl', 'Biceps', 'Smith machine'],

  // --- Triceps ---
  ['Skull crusher', 'Triceps', 'Barbell'],
  ['Close-grip bench press', 'Triceps', 'Barbell'],
  ['Overhead triceps extension', 'Triceps', 'Dumbbell'],
  ['Triceps kickback', 'Triceps', 'Dumbbell'],
  ['Triceps pushdown', 'Triceps', 'Cable'],
  ['Rope pushdown', 'Triceps', 'Cable'],
  ['Cable overhead extension', 'Triceps', 'Cable'],
  ['Machine dip', 'Triceps', 'Machine'],
  ['Smith machine close-grip bench press', 'Triceps', 'Smith machine'],
  ['Smith machine JM press', 'Triceps', 'Smith machine'],
  ['Smith machine skull crusher', 'Triceps', 'Smith machine'],
  ['Diamond push-ups', 'Triceps', 'Calisthenics'],
  ['Bench dips', 'Triceps', 'Calisthenics'],
  ['Bodyweight triceps extension', 'Triceps', 'Calisthenics'],

  // --- Quads ---
  ['Squat', 'Quads', 'Barbell'],
  ['Front squat', 'Quads', 'Barbell'],
  ['Barbell lunge', 'Quads', 'Barbell'],
  ['Goblet squat', 'Quads', 'Dumbbell'],
  ['Bulgarian split squat', 'Quads', 'Dumbbell'],
  ['Lunge', 'Quads', 'Dumbbell'],
  ['Dumbbell step-up', 'Quads', 'Dumbbell'],
  ['Leg press', 'Quads', 'Machine'],
  ['Hack squat', 'Quads', 'Machine'],
  ['Leg extension', 'Quads', 'Machine'],
  ['Smith machine squat', 'Quads', 'Smith machine'],
  ['Smith machine front squat', 'Quads', 'Smith machine'],
  ['Smith machine hack squat', 'Quads', 'Smith machine'],
  ['Smith machine split squat', 'Quads', 'Smith machine'],
  ['Smith machine Bulgarian split squat', 'Quads', 'Smith machine'],
  ['Smith machine lunge', 'Quads', 'Smith machine'],
  ['Smith machine reverse lunge', 'Quads', 'Smith machine'],
  ['Bodyweight squat', 'Quads', 'Calisthenics'],
  ['Jump squat', 'Quads', 'Calisthenics'],
  ['Pistol squat', 'Quads', 'Calisthenics'],
  ['Cossack squat', 'Quads', 'Calisthenics'],
  ['Sissy squat', 'Quads', 'Calisthenics'],
  ['Walking lunge', 'Quads', 'Calisthenics'],
  ['Step-ups', 'Quads', 'Calisthenics'],
  ['Box jump', 'Quads', 'Calisthenics'],
  ['Burpees', 'Quads', 'Calisthenics'],
  ['Wall sit', 'Quads', 'Calisthenics', 'hold'],

  // --- Hamstrings ---
  ['Romanian deadlift', 'Hamstrings', 'Barbell'],
  ['Stiff-leg deadlift', 'Hamstrings', 'Barbell'],
  ['Good morning', 'Hamstrings', 'Barbell'],
  ['Dumbbell Romanian deadlift', 'Hamstrings', 'Dumbbell'],
  ['Leg curl', 'Hamstrings', 'Machine'],
  ['Seated leg curl', 'Hamstrings', 'Machine'],
  ['Smith machine Romanian deadlift', 'Hamstrings', 'Smith machine'],
  ['Smith machine stiff-leg deadlift', 'Hamstrings', 'Smith machine'],
  ['Smith machine good morning', 'Hamstrings', 'Smith machine'],
  ['Nordic curl', 'Hamstrings', 'Calisthenics'],

  // --- Glutes ---
  ['Hip thrust', 'Glutes', 'Barbell'],
  ['Glute bridge', 'Glutes', 'Barbell'],
  ['Sumo deadlift', 'Glutes', 'Barbell'],
  ['Cable kickback', 'Glutes', 'Cable'],
  ['Hip abduction machine', 'Glutes', 'Machine'],
  ['Smith machine hip thrust', 'Glutes', 'Smith machine'],
  ['Smith machine glute bridge', 'Glutes', 'Smith machine'],
  ['Smith machine sumo squat', 'Glutes', 'Smith machine'],
  ['Smith machine kneeling squat', 'Glutes', 'Smith machine'],
  ['Smith machine donkey kick', 'Glutes', 'Smith machine'],
  ['Single-leg glute bridge', 'Glutes', 'Calisthenics'],
  ['Donkey kicks', 'Glutes', 'Calisthenics'],

  // --- Calves ---
  ['Calf raise', 'Calves', 'Machine'],
  ['Seated calf raise', 'Calves', 'Machine'],
  ['Single-leg calf raise', 'Calves', 'Dumbbell'],
  ['Smith machine calf raise', 'Calves', 'Smith machine'],
  ['Smith machine seated calf raise', 'Calves', 'Smith machine'],
  ['Bodyweight calf raise', 'Calves', 'Calisthenics'],

  // --- Core ---
  ['Cable crunch', 'Core', 'Cable'],
  ['Pallof press', 'Core', 'Cable'],
  ['Ab crunch machine', 'Core', 'Machine'],
  ['Crunch', 'Core', 'Calisthenics'],
  ['Sit-ups', 'Core', 'Calisthenics'],
  ['Bicycle crunch', 'Core', 'Calisthenics'],
  ['V-ups', 'Core', 'Calisthenics'],
  ['Lying leg raise', 'Core', 'Calisthenics'],
  ['Hanging knee raise', 'Core', 'Calisthenics'],
  ['Hanging leg raise', 'Core', 'Calisthenics'],
  ['Toes-to-bar', 'Core', 'Calisthenics'],
  ['Ab wheel rollout', 'Core', 'Calisthenics'],
  ['Russian twist', 'Core', 'Calisthenics'],
  ['Mountain climbers', 'Core', 'Calisthenics'],
  ['Flutter kicks', 'Core', 'Calisthenics'],
  ['Dead bug', 'Core', 'Calisthenics'],
  ['Dragon flag', 'Core', 'Calisthenics'],
  ['Plank', 'Core', 'Calisthenics', 'hold'],
  ['Side plank', 'Core', 'Calisthenics', 'hold'],
  ['Hollow body hold', 'Core', 'Calisthenics', 'hold'],
  ['L-sit', 'Core', 'Calisthenics', 'hold'],

  // --- Cardio (time, plus distance if you want it) ---
  ['Treadmill run', 'Cardio', 'Machine'],
  ['Treadmill walk', 'Cardio', 'Machine'],
  ['Incline walk', 'Cardio', 'Machine'],
  ['Stationary bike', 'Cardio', 'Machine'],
  ['Spin bike', 'Cardio', 'Machine'],
  ['Air bike', 'Cardio', 'Machine'],
  ['Rowing machine', 'Cardio', 'Machine'],
  ['Elliptical', 'Cardio', 'Machine'],
  ['Stair climber', 'Cardio', 'Machine'],
  ['Ski erg', 'Cardio', 'Machine'],
  ['Outdoor run', 'Cardio', 'Outdoors'],
  ['Outdoor walk', 'Cardio', 'Outdoors'],
  ['Outdoor cycling', 'Cardio', 'Outdoors'],
  ['Hiking', 'Cardio', 'Outdoors'],
  ['Swimming', 'Cardio', 'Pool'],
  ['Jump rope', 'Cardio', 'Calisthenics'],
  ['Jumping jacks', 'Cardio', 'Calisthenics'],
  ['Interval training', 'Cardio', 'Calisthenics'],
].map(([name, muscle, equipment, kind]) => ({ name, muscle, equipment, kind: kind || (muscle === 'Cardio' ? 'cardio' : null) }));

// Ready-made routines: [exercise, sets, reps]. For holds the last number is seconds.
const TEMPLATES = [
  { name: 'Push', tag: 'Push / Pull / Legs', exercises: [
    ['Bench press', 3, 8], ['Overhead press', 3, 8], ['Incline dumbbell press', 3, 10], ['Lateral raise', 3, 12], ['Triceps pushdown', 3, 12]] },
  { name: 'Pull', tag: 'Push / Pull / Legs', exercises: [
    ['Deadlift', 3, 5], ['Pull-ups', 3, 8], ['Barbell row', 3, 8], ['Face pull', 3, 15], ['Barbell curl', 3, 10]] },
  { name: 'Legs', tag: 'Push / Pull / Legs', exercises: [
    ['Squat', 3, 6], ['Romanian deadlift', 3, 8], ['Leg press', 3, 10], ['Leg curl', 3, 12], ['Calf raise', 3, 12]] },
  { name: 'Upper body', tag: 'Upper / Lower', exercises: [
    ['Bench press', 3, 8], ['Barbell row', 3, 8], ['Overhead press', 3, 8], ['Lat pulldown', 3, 10], ['Dumbbell curl', 3, 12], ['Triceps pushdown', 3, 12]] },
  { name: 'Lower body', tag: 'Upper / Lower', exercises: [
    ['Squat', 3, 6], ['Romanian deadlift', 3, 8], ['Leg press', 3, 10], ['Leg curl', 3, 12], ['Calf raise', 3, 15], ['Hanging leg raise', 3, 12]] },
  { name: 'Full body', tag: 'Three days a week', exercises: [
    ['Squat', 3, 5], ['Bench press', 3, 5], ['Barbell row', 3, 5], ['Overhead press', 3, 8], ['Hanging leg raise', 3, 10]] },
  { name: 'Strength 5×5 A', tag: 'Beginner strength', exercises: [
    ['Squat', 5, 5], ['Bench press', 5, 5], ['Barbell row', 5, 5]] },
  { name: 'Strength 5×5 B', tag: 'Beginner strength', exercises: [
    ['Squat', 5, 5], ['Overhead press', 5, 5], ['Deadlift', 1, 5]] },
  { name: 'Calisthenics basics', tag: 'No equipment', exercises: [
    ['Push-ups', 3, 10], ['Inverted rows', 3, 8], ['Bodyweight squat', 3, 15], ['Hanging knee raise', 3, 10], ['Plank', 3, 45]] },
  { name: 'Smith machine full body', tag: 'One machine', exercises: [
    ['Smith machine squat', 3, 8], ['Smith machine bench press', 3, 8], ['Smith machine bent-over row', 3, 8],
    ['Smith machine overhead press', 3, 10], ['Smith machine hip thrust', 3, 10]] },
].map(t => ({
  ...t,
  exercises: t.exercises.map(([name, sets, amount]) => {
    const kind = EXERCISE_LIBRARY.find(e => e.name === name).kind;
    const set = kind ? { seconds: amount, distance: '', type: 'normal' } : { reps: amount, weight: '', type: 'normal' };
    return { name, kind, sets: Array.from({ length: sets }, () => ({ ...set })) };
  }),
}));

const SET_TYPES = {
  normal: { label: '', title: 'Working set' },
  warmup: { label: 'W', title: 'Warm-up set (not counted in your stats)' },
  drop: { label: 'D', title: 'Drop set' },
  failure: { label: 'F', title: 'Taken to failure' },
};

const MEASUREMENTS = ['Body fat', 'Waist', 'Chest', 'Arms', 'Thighs', 'Hips'];
