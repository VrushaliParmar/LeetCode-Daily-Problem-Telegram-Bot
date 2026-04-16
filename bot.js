require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const axios = require('axios');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const CHAT_ID = process.env.CHAT_ID;
const USERNAME = process.env.LEETCODE_USERNAME;

async function getLeetCodeStats(username) {
  const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
        userCalendar {
          streak
          totalActiveDays
          submissionCalendar
        }
      }
    }
  `;
  try {
    const res = await axios.post('https://leetcode.com/graphql', {
      query,
      variables: { username }
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    return res.data.data.matchedUser;
  } catch (e) {
    return null;
  }
}

async function solvedTodayCount(username) {
  const data = await getLeetCodeStats(username);
  if (!data) return 0;
  const calendar = JSON.parse(data.userCalendar.submissionCalendar);
  const todayKey = Math.floor(Date.now() / 1000 / 86400) * 86400;
  return calendar[todayKey] || 0;
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log('Your Chat ID is:', chatId);
  bot.sendMessage(chatId,
    `👋 Hello! I'm your LeetCode Reminder Bot!\n\n` +
    `📌 Your Chat ID is: ${chatId}\n` +
    `Copy this and paste it as CHAT_ID in your .env file.\n\n` +
    `Commands:\n/stats - your stats\n/streak - current streak\n/today - solved today?`
  );
});

bot.onText(/\/stats/, async (msg) => {
  const data = await getLeetCodeStats(USERNAME);
  if (!data) return bot.sendMessage(msg.chat.id, '❌ Could not fetch stats.');
  const ac = data.submitStats.acSubmissionNum;
  const easy = ac.find(x => x.difficulty === 'Easy')?.count || 0;
  const med  = ac.find(x => x.difficulty === 'Medium')?.count || 0;
  const hard = ac.find(x => x.difficulty === 'Hard')?.count || 0;
  bot.sendMessage(msg.chat.id,
    `📊 LeetCode Stats for ${USERNAME}\n\n` +
    `🟢 Easy: ${easy}\n🟡 Medium: ${med}\n🔴 Hard: ${hard}\n` +
    `🔥 Streak: ${data.userCalendar.streak} days`
  );
});

bot.onText(/\/streak/, async (msg) => {
  const data = await getLeetCodeStats(USERNAME);
  if (!data) return bot.sendMessage(msg.chat.id, '❌ Could not fetch stats.');
  bot.sendMessage(msg.chat.id,
    `🔥 Current streak: ${data.userCalendar.streak} days\n` +
    `📅 Total active days: ${data.userCalendar.totalActiveDays}`
  );
});

bot.onText(/\/today/, async (msg) => {
  const count = await solvedTodayCount(USERNAME);
  bot.sendMessage(msg.chat.id,
    count > 0
      ? `✅ You've solved ${count} problem(s) today! Keep it up! 💪`
      : `😴 No submissions yet today. Go solve one! 🚀`
  );
});

// 6:00 PM IST = 12:30 UTC
cron.schedule('30 12 * * *', async () => {
  if (!CHAT_ID) return;
  const data = await getLeetCodeStats(USERNAME);
  const streak = data?.userCalendar?.streak || 0;
  bot.sendMessage(CHAT_ID,
    `⏰ Daily LeetCode Reminder!\n\n` +
    `Hey Vrushali! Time to solve today's problem 🚀\n` +
    `🔥 Current streak: ${streak} days\n\n` +
    `👉 https://leetcode.com/problemset/\n\n` +
    `You've got this! 💪`
  );
}, { timezone: 'UTC' });

// 10:00 PM IST = 16:30 UTC
cron.schedule('30 16 * * *', async () => {
  if (!CHAT_ID) return;
  const count = await solvedTodayCount(USERNAME);
  if (count === 0) {
    bot.sendMessage(CHAT_ID,
      `⚠️ Streak Danger Alert!\n\n` +
      `Vrushali, you haven't solved anything today!\n` +
      `Your streak is at risk! 😱\n\n` +
      `Quick - even 1 easy problem saves your streak!\n` +
      `👉 https://leetcode.com/problems/two-sum/`
    );
  }
}, { timezone: 'UTC' });

console.log('✅ Bot is running...');