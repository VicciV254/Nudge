import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const at = (days, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  const email = 'demo@nudge.app';
  const passwordHash = await bcrypt.hash('Demo1234', 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, displayName: 'Demo User', passwordHash, timezone: 'Africa/Nairobi' },
  });

  await prisma.task.deleteMany({ where: { userId: user.id } });

  const tasks = [
    { title: 'Send Q3 report to Amina', dueDate: at(0, 9),  priority: 'urgent', category: 'Work', calendarSync: true, syncStatus: 'synced' },
    { title: 'Design review with the team', dueDate: at(0, 14), priority: 'normal', category: 'Work', calendarSync: true, syncStatus: 'synced' },
    { title: 'Book dentist', dueDate: at(-2, 11), priority: 'high', category: 'Health' },
    { title: 'Renew domain', dueDate: at(1, 12), priority: 'low', category: 'Personal' },
    { title: 'Plan sprint retro', dueDate: at(3, 10), priority: 'normal', category: 'Work' },
    { title: 'Buy coffee beans', priority: 'low', category: 'Errands' },
    { title: 'Reply to landlord', dueDate: at(-1, 10), priority: 'normal', completed: true, completedAt: at(-1, 12) },
    { title: 'Submit expenses', dueDate: at(-3, 16), priority: 'high', completed: true, completedAt: at(-3, 17), category: 'Work' },
  ];

  await prisma.task.createMany({ data: tasks.map((t) => ({ ...t, userId: user.id })) });

  // A recurring series + its first instance. The series row is a template and
  // never appears in the task list; only the instance does.
  const series = await prisma.task.create({
    data: {
      title: 'Send the weekly report',
      description: 'Numbers for the team',
      priority: 'high',
      category: 'Work',
      userId: user.id,
      dueDate: at(1, 9),
      recurrence: 'FREQ=WEEKLY;BYDAY=MO',
      recurrenceStart: at(1, 9),
    },
  });
  await prisma.task.create({
    data: {
      title: series.title,
      description: series.description,
      priority: series.priority,
      category: series.category,
      userId: user.id,
      dueDate: at(1, 9),
      seriesId: series.id,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      tasksCreated: tasks.length,
      tasksCompleted: tasks.filter((t) => t.completed).length,
      streak: 4,
    },
  });

  console.log(`Seeded ${tasks.length} tasks + 1 weekly series for ${email} (password: Demo1234)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
