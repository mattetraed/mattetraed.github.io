// Supabase: set your project URL and anon key (Dashboard → Settings → API).
// Profiles table: needs "id" (uuid, PK) and "level" (integer). Enable RLS and allow
// select/update for authenticated user (e.g. auth.uid() = id).
const SUPABASE_URL = 'https://tepmshukrzhqxvhxpbbn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ilPlyWkH575-4_l5deE02w_Kba5odsD';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let level = 0;
let MAX = 5;
let REQUIRED_CORRECT = 5;
let correctCounter = 0;
let currentAnswer = 0;
let gameOver = false;
let isWaitingForNextQuestion = false;

const CORRECT_ANSWER_DELAY_MS = 1500;
const WRONG_ANSWER_DELAY_MS = 5000;

function generateQuestion() {
    if (gameOver) return;

    // Generate a between MAX and 100 (or higher if MAX > 100)
    const maxA = Math.max(100, MAX + 20); // Ensure we have range even at high levels
    const a = Math.floor(Math.random() * (maxA - MAX + 1)) + MAX;

    // Generate b between 0 and MAX, but never larger than a
    const maxB = Math.min(MAX, a);
    const b = Math.floor(Math.random() * (maxB + 1));

    currentAnswer = a - b;

    console.log(`Genererat: ${a} - ${b} = ${currentAnswer} (MAX=${MAX}, always positive!)`);

    document.getElementById('question').textContent = `${a} - ${b} = ?`;

    generateAnswerOptions();
}

function generateAnswerOptions() {
    const answers = new Set();
    answers.add(currentAnswer);

    // Generate 7 other unique wrong answers
    while (answers.size < 8) {
        const offset = Math.floor(Math.random() * 21) - 10; // -10 to +10
        const wrongAnswer = currentAnswer + offset;
        if (wrongAnswer >= 0 && wrongAnswer <= 100) {
            answers.add(wrongAnswer);
        }
    }

    // Convert to array and shuffle
    const answerArray = Array.from(answers).sort(() => Math.random() - 0.5);

    // Create buttons
    const answersDiv = document.getElementById('answers');
    answersDiv.innerHTML = '';

    answerArray.forEach(answer => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = answer;
        btn.onclick = () => checkAnswer(answer);
        answersDiv.appendChild(btn);
    });
}

function checkAnswer(answer) {
    if (gameOver || isWaitingForNextQuestion) return;

    const feedback = document.getElementById('feedback');
    const wasCorrect = answer === currentAnswer;

    if (wasCorrect) {
        feedback.textContent = 'Rätt!';
        feedback.className = 'feedback correct';
        correctCounter++;
    } else {
        feedback.textContent = `Fel! Rätt svar är ${currentAnswer}`;
        feedback.className = 'feedback wrong';
        correctCounter = Math.max(0, correctCounter - 1);
    }

    document.getElementById('counter').textContent = correctCounter;

    if (correctCounter === REQUIRED_CORRECT) {
        gameOver = true;
        document.getElementById('winMessage').innerHTML = `
            <div class="win-message">🎉 Grattis! Du klarade nivå ${level}!</div>
            <button class="restart-btn" onclick="nextLevel()">Nästa nivå ➡️</button>
        `;
        document.getElementById('answers').innerHTML = '';
    } else {
        isWaitingForNextQuestion = true;
        document.querySelectorAll('#answers .answer-btn').forEach(btn => btn.setAttribute('disabled', ''));
        const delayMs = wasCorrect ? CORRECT_ANSWER_DELAY_MS : WRONG_ANSWER_DELAY_MS;
        setTimeout(() => {
            isWaitingForNextQuestion = false;
            feedback.textContent = '';
            generateQuestion();
        }, delayMs);
    }
}

function updateLevelDisplay() {
    document.getElementById('level').textContent = level;
    document.getElementById('required').textContent = REQUIRED_CORRECT;
}

function restartGame() {
    correctCounter = 0;
    gameOver = false;
    document.getElementById('counter').textContent = '0';
    document.getElementById('feedback').textContent = '';
    document.getElementById('winMessage').innerHTML = '';
    generateQuestion();
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('gameContainer').classList.remove('active');
    document.getElementById('loginError').textContent = '';
    document.getElementById('loginForm').reset();
}

function showGame() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('gameContainer').classList.add('active');
    restartGame();
}

async function loadUserLevel(userOverride) {
    const user = userOverride ?? (await supabase.auth.getUser()).data?.user;
    if (!user) return;
    const { data } = await supabase
        .from('profiles')
        .select('level')
        .eq('id', user.id)
        .maybeSingle();
    if (data && data.level != null) {
        level = Math.max(0, parseInt(data.level, 10) || 0);
        MAX = 5 + level;
        REQUIRED_CORRECT = 5 + level;
        updateLevelDisplay();
    } else {
        // New user: create profile and set level 0 in memory (level 0 = max 5)
        level = 0;
        MAX = 5;
        REQUIRED_CORRECT = 5;
        updateLevelDisplay();
        await supabase.from('profiles').upsert({ id: user.id, level: 0 }, { onConflict: 'id' });
    }
}

async function saveUserLevel() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
        .from('profiles')
        .update({ level })
        .eq('id', user.id);
}

async function login(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPin').value;
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');
    if (!username || !password) {
        errEl.textContent = 'Fyll i båda fälten.';
        return;
    }
    errEl.textContent = '';
    btn.disabled = true;
    const email = username + '@mattetraed.com';
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    btn.disabled = false;
    if (error) {
        errEl.textContent = error.message || 'Inloggning misslyckades.';
        return;
    }
    // Use the user we just signed in so we never load the previous user's level
    await loadUserLevel(data.user);
    showGame();
}

async function logout() {
    await supabase.auth.signOut();
    showLoginScreen();
}
window.logout = logout;

function nextLevel() {
    level++;
    MAX = 5 + level;
    REQUIRED_CORRECT = 5 + level;
    updateLevelDisplay();
    saveUserLevel();
    restartGame();
}
window.nextLevel = nextLevel;

// Initialize: check session and bind login form
document.getElementById('loginForm').addEventListener('submit', login);

(async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        await loadUserLevel();
        showGame();
    } else {
        showLoginScreen();
    }
    updateLevelDisplay();
})();
