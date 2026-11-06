import "dotenv/config";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createGeminiInterpreter } from "./services/gemini.js";
import { createReminderRouter } from "./routes/reminders.js";

const config = loadConfig();
const interpreter = config.reminderConfigurationError
  ? null
  : createGeminiInterpreter({
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
    });
const reminderRouter = createReminderRouter({ config, interpreter });
const app = createApp({ config, reminderRouter });

app.listen(config.port, () => {
  console.log(`Reminder API listening on port ${config.port}.`);
});
