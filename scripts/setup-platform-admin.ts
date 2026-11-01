import fs from "fs";
import path from "path";
import readline from "readline";

function loadEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function readHidden(prompt: string) {
  return new Promise<string>((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || !input.setRawMode) {
      reject(new Error("Run this command in an interactive terminal so the password can be entered privately."));
      return;
    }
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let value = "";
    const onData = (character: string) => {
      if (character === "\u0003") {
        input.setRawMode(false);
        input.pause();
        input.off("data", onData);
        reject(new Error("Setup cancelled."));
      } else if (character === "\r" || character === "\n") {
        input.setRawMode(false);
        input.pause();
        input.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (character === "\u007f" || character === "\b") {
        value = value.slice(0, -1);
      } else {
        value += character;
      }
    };
    input.on("data", onData);
  });
}

async function main() {
  loadEnv();
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const name = (await new Promise<string>((resolve) => prompt.question("Platform admin name: ", resolve))).trim();
  const email = (await new Promise<string>((resolve) => prompt.question("Platform admin email: ", resolve))).trim();
  prompt.close();
  const password = await readHidden("Platform admin password (input hidden): ");
  const confirmation = await readHidden("Confirm password (input hidden): ");
  if (password !== confirmation) throw new Error("Passwords do not match.");

  const { configurePlatformAdmin } = await import("../src/server/seed");
  await configurePlatformAdmin(name, email, password);
  console.log("Platform admin account saved in Supabase. Only the password hash is stored.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Platform admin setup failed.");
  process.exitCode = 1;
});