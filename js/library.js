'use strict';

const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];

// Built-in exercises: [name, primary muscle, equipment]
const EXERCISE_LIBRARY = [
  ['Bench press', 'Chest', 'Barbell'],
  ['Incline bench press', 'Chest', 'Barbell'],
  ['Decline bench press', 'Chest', 'Barbell'],
  ['Dumbbell bench press', 'Chest', 'Dumbbell'],
  ['Incline dumbbell press', 'Chest', 'Dumbbell'],
  ['Chest fly', 'Chest', 'Dumbbell'],
  ['Cable crossover', 'Chest', 'Cable'],
  ['Machine chest press', 'Chest', 'Machine'],
  ['Pec deck', 'Chest', 'Machine'],
  ['Push-ups', 'Chest', 'Bodyweight'],
  ['Dips', 'Chest', 'Bodyweight'],

  ['Deadlift', 'Back', 'Barbell'],
  ['Barbell row', 'Back', 'Barbell'],
  ['Dumbbell row', 'Back', 'Dumbbell'],
  ['T-bar row', 'Back', 'Barbell'],
  ['Seated cable row', 'Back', 'Cable'],
  ['Lat pulldown', 'Back', 'Cable'],
  ['Pull-ups', 'Back', 'Bodyweight'],
  ['Chin-ups', 'Back', 'Bodyweight'],
  ['Rack pull', 'Back', 'Barbell'],
  ['Shrug', 'Back', 'Dumbbell'],
  ['Back extension', 'Back', 'Bodyweight'],

  ['Overhead press', 'Shoulders', 'Barbell'],
  ['Dumbbell shoulder press', 'Shoulders', 'Dumbbell'],
  ['Arnold press', 'Shoulders', 'Dumbbell'],
  ['Lateral raise', 'Shoulders', 'Dumbbell'],
  ['Cable lateral raise', 'Shoulders', 'Cable'],
  ['Front raise', 'Shoulders', 'Dumbbell'],
  ['Rear delt fly', 'Shoulders', 'Dumbbell'],
  ['Face pull', 'Shoulders', 'Cable'],
  ['Upright row', 'Shoulders', 'Barbell'],

  ['Barbell curl', 'Biceps', 'Barbell'],
  ['Dumbbell curl', 'Biceps', 'Dumbbell'],
  ['Hammer curl', 'Biceps', 'Dumbbell'],
  ['Preacher curl', 'Biceps', 'Barbell'],
  ['Incline dumbbell curl', 'Biceps', 'Dumbbell'],
  ['Cable curl', 'Biceps', 'Cable'],

  ['Triceps pushdown', 'Triceps', 'Cable'],
  ['Skull crusher', 'Triceps', 'Barbell'],
  ['Overhead triceps extension', 'Triceps', 'Dumbbell'],
  ['Close-grip bench press', 'Triceps', 'Barbell'],
  ['Triceps kickback', 'Triceps', 'Dumbbell'],
  ['Bench dips', 'Triceps', 'Bodyweight'],

  ['Squat', 'Quads', 'Barbell'],
  ['Front squat', 'Quads', 'Barbell'],
  ['Leg press', 'Quads', 'Machine'],
  ['Hack squat', 'Quads', 'Machine'],
  ['Leg extension', 'Quads', 'Machine'],
  ['Bulgarian split squat', 'Quads', 'Dumbbell'],
  ['Lunge', 'Quads', 'Dumbbell'],
  ['Goblet squat', 'Quads', 'Dumbbell'],

  ['Romanian deadlift', 'Hamstrings', 'Barbell'],
  ['Stiff-leg deadlift', 'Hamstrings', 'Barbell'],
  ['Leg curl', 'Hamstrings', 'Machine'],
  ['Seated leg curl', 'Hamstrings', 'Machine'],
  ['Good morning', 'Hamstrings', 'Barbell'],

  ['Hip thrust', 'Glutes', 'Barbell'],
  ['Glute bridge', 'Glutes', 'Barbell'],
  ['Sumo deadlift', 'Glutes', 'Barbell'],
  ['Cable kickback', 'Glutes', 'Cable'],

  ['Calf raise', 'Calves', 'Machine'],
  ['Seated calf raise', 'Calves', 'Machine'],
  ['Single-leg calf raise', 'Calves', 'Dumbbell'],

  ['Hanging leg raise', 'Core', 'Bodyweight'],
  ['Crunch', 'Core', 'Bodyweight'],
  ['Cable crunch', 'Core', 'Cable'],
  ['Sit-ups', 'Core', 'Bodyweight'],
  ['Ab wheel rollout', 'Core', 'Bodyweight'],
  ['Russian twist', 'Core', 'Bodyweight'],
].map(([name, muscle, equipment]) => ({ name, muscle, equipment }));

// Ready-made routines: [exercise, sets, reps]
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
].map(t => ({
  ...t,
  exercises: t.exercises.map(([name, sets, reps]) => ({
    name,
    sets: Array.from({ length: sets }, () => ({ reps, weight: '', type: 'normal' })),
  })),
}));

const SET_TYPES = {
  normal: { label: '', title: 'Working set' },
  warmup: { label: 'W', title: 'Warm-up set (not counted in your stats)' },
  drop: { label: 'D', title: 'Drop set' },
  failure: { label: 'F', title: 'Taken to failure' },
};

const MEASUREMENTS = ['Body fat', 'Waist', 'Chest', 'Arms', 'Thighs', 'Hips'];
