/* Fitness Tracker - client side (localStorage)
   Data model:
   localStorage.fitnessData = {
     "2025-10-01": [ {id, type, steps, workout, calories, note, createdAt}, ... ],
     "2025-10-02": [ ... ],
     ...
   }
*/

const KEY = 'fitnessData';
const datePicker = document.getElementById('datePicker');
const addEntryBtn = document.getElementById('addEntryBtn');
const entryForm = document.getElementById('entryForm');
const formTitle = document.getElementById('formTitle');
const activityType = document.getElementById('activityType');
const inputSteps = document.getElementById('inputSteps');
const inputWorkout = document.getElementById('inputWorkout');
const inputCalories = document.getElementById('inputCalories');
const saveEntryBtn = document.getElementById('saveEntryBtn');
const cancelEntryBtn = document.getElementById('cancelEntryBtn');

const sumStepsEl = document.getElementById('sumSteps');
const sumWorkoutEl = document.getElementById('sumWorkout');
const sumCaloriesEl = document.getElementById('sumCalories');
const entriesList = document.getElementById('entriesList');
const entriesDateLabel = document.getElementById('entriesDateLabel');
const goalSteps = document.getElementById('goalSteps');
const goalStepsValue = document.getElementById('goalStepsValue');
const stepsProgress = document.getElementById('stepsProgress');

const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');
let weeklyChart = null;

let editing = null; // {date, id} when editing entry

// Helpers
function todayStr() {
  return new Date().toISOString().slice(0,10); // YYYY-MM-DD
}

function loadStorage() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch (e) {
    console.error('invalid storage', e);
    return {};
  }
}

function saveStorage(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

// UI init
datePicker.value = todayStr();
goalStepsValue.textContent = goalSteps.value;

// Event handlers
addEntryBtn.addEventListener('click', () => openForm('Add'));
cancelEntryBtn.addEventListener('click', closeForm);
saveEntryBtn.addEventListener('click', saveEntry);
datePicker.addEventListener('change', refreshAll);
goalSteps.addEventListener('input', () => {
  goalStepsValue.textContent = goalSteps.value;
  refreshAll();
});

function openForm(mode, existing = null) {
  entryForm.style.display = 'block';
  formTitle.textContent = (mode === 'Add') ? 'Add Activity' : 'Edit Activity';
  editing = null;
  if (existing) {
    // populate fields for editing
    activityType.value = existing.type;
    inputSteps.value = existing.steps || '';
    inputWorkout.value = existing.workout || '';
    inputCalories.value = existing.calories || '';
    editing = existing;
  } else {
    activityType.value = 'Walking';
    inputSteps.value = '';
    inputWorkout.value = '';
    inputCalories.value = '';
  }
}

function closeForm() {
  entryForm.style.display = 'none';
  editing = null;
}

function saveEntry() {
  const date = datePicker.value || todayStr();
  const data = loadStorage();
  if (!data[date]) data[date] = [];

  const steps = Number(inputSteps.value || 0);
  const workout = Number(inputWorkout.value || 0);
  const calories = Number(inputCalories.value || 0);
  const type = activityType.value || 'Other';
  const now = Date.now();

  if (editing) {
    // find and update
    const idx = data[editing.date].findIndex(e => e.id === editing.id);
    if (idx !== -1) {
      data[editing.date][idx] = { ...data[editing.date][idx], type, steps, workout, calories, updatedAt: now };
    }
  } else {
    const entry = {
      id: 'id' + now,
      type,
      steps,
      workout,
      calories,
      createdAt: now
    };
    data[date].push(entry);
  }

  saveStorage(data);
  closeForm();
  refreshAll();
}

// Aggregation helpers
function aggregateDay(entries) {
  return entries.reduce((acc,e)=>{
    acc.steps += Number(e.steps || 0);
    acc.workout += Number(e.workout || 0);
    acc.calories += Number(e.calories || 0);
    return acc;
  }, {steps:0, workout:0, calories:0});
}

function lastNDates(n, endDateStr) {
  const end = new Date(endDateStr || todayStr());
  const arr = [];
  for (let i = n-1; i >=0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    arr.push(d.toISOString().slice(0,10));
  }
  return arr;
}

// Render functions
function renderSummaryFor(date) {
  const data = loadStorage();
  const entries = data[date] || [];
  const agg = aggregateDay(entries);

  sumStepsEl.textContent = agg.steps;
  sumWorkoutEl.textContent = agg.workout;
  sumCaloriesEl.textContent = agg.calories;

  // progress
  const goal = Number(goalSteps.value);
  const pct = goal > 0 ? Math.min(100, Math.round((agg.steps/goal)*100)) : 0;
  stepsProgress.style.width = pct + '%';
}

function renderEntriesFor(date) {
  const data = loadStorage();
  const entries = data[date] || [];
  entriesDateLabel.textContent = date;

  entriesList.innerHTML = '';
  if (entries.length === 0) {
    entriesList.innerHTML = '<li>No entries for this day.</li>';
    return;
  }

  entries.forEach(e => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<strong>${e.type}</strong><div class="entry-meta">Steps: ${e.steps || 0} • Workout: ${e.workout || 0} min • Calories: ${e.calories || 0}</div>`;
    const actions = document.createElement('div');
    actions.className = 'entry-actions';
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', ()=>{
      // open form set editing
      openForm('Edit', { ...e, date });
      // store editing identifier so save knows
      editing = { date, id: e.id };
    });
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', ()=>{
      if (!confirm('Delete this entry?')) return;
      const data2 = loadStorage();
      data2[date] = data2[date].filter(x => x.id !== e.id);
      if (data2[date].length === 0) delete data2[date];
      saveStorage(data2);
      refreshAll();
    });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(actions);
    entriesList.appendChild(li);
  });
}

function renderWeeklyChart(endDateStr) {
  const data = loadStorage();
  const days = lastNDates(7, endDateStr);
  const stepsArr = days.map(d => {
    const entries = data[d] || [];
    return aggregateDay(entries).steps;
  });
  const caloriesArr = days.map(d => {
    const entries = data[d] || [];
    return aggregateDay(entries).calories;
  });

  const labels = days.map(d => {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  });

  if (weeklyChart) weeklyChart.destroy();

  weeklyChart = new Chart(weeklyCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Steps', data: stepsArr, backgroundColor: 'rgba(75,192,192,0.6)' },
        { label: 'Calories', data: caloriesArr, backgroundColor: 'rgba(153,102,255,0.6)' }
      ]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      scales: {
        y: {
          beginAtZero:true
        }
      }
    }
  });
}

// refresh whole UI
function refreshAll() {
  const selectedDate = datePicker.value || todayStr();
  renderSummaryFor(selectedDate);
  renderEntriesFor(selectedDate);
  renderWeeklyChart(selectedDate);
}

// initial load
(function init(){
  // ensure datePicker has a value
  if (!datePicker.value) datePicker.value = todayStr();
  refreshAll();
})();
