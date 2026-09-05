import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const usersFile = path.join(directory, "users.json");
const expensesFile = path.join(directory, "expenses.json");

async function readCollection(file) {
  try {
    const value = JSON.parse(await readFile(file, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeCollection(file, items) {
  await mkdir(directory, { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export function userView(user) {
  const { password, id, _id, ...safeUser } = user;
  return { ...safeUser, _id: String(_id || id) };
}

function expenseView(expense) {
  const { id, _id, email, ...rest } = expense;
  return { ...rest, userEmail: rest.userEmail || email, _id: String(_id || id) };
}

export async function findUser(email) {
  const users = await readCollection(usersFile);
  return users.find((user) => String(user.email || "").toLowerCase() === email) || null;
}

export async function createUser(user) {
  const users = await readCollection(usersFile);
  const record = { _id: randomUUID(), income: 0, photoUrl: "", ...user };
  users.push(record);
  await writeCollection(usersFile, users);
  return record;
}

export async function updateUser(email, updates) {
  const users = await readCollection(usersFile);
  const index = users.findIndex((user) => String(user.email || "").toLowerCase() === email);
  if (index === -1) return null;
  users[index] = { ...users[index], ...updates };
  await writeCollection(usersFile, users);
  return users[index];
}

export async function findExpenses(email) {
  const expenses = await readCollection(expensesFile);
  return expenses
    .filter((expense) => String(expense.userEmail || expense.email || "").toLowerCase() === email)
    .map(expenseView);
}

export async function createExpense(expense) {
  const expenses = await readCollection(expensesFile);
  const record = { _id: randomUUID(), ...expense };
  expenses.push(record);
  await writeCollection(expensesFile, expenses);
  return expenseView(record);
}

export async function deleteExpense(id, email) {
  const expenses = await readCollection(expensesFile);
  const index = expenses.findIndex(
    (expense) => String(expense._id || expense.id) === String(id) && String(expense.userEmail || expense.email || "").toLowerCase() === email
  );
  if (index === -1) return null;
  const [deleted] = expenses.splice(index, 1);
  await writeCollection(expensesFile, expenses);
  return expenseView(deleted);
}
