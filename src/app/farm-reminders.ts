type Row = Record<string, unknown>;

export interface ReminderItem {
  title: string;
  detail: string;
  date: string;
  overdue: boolean;
  route: string;
}
export interface Reminders {
  overdueTasks: number;
  healthDue: number;
  lowStock: number;
  maintenanceDue: number;
  month: { income: number; expenses: number } | null;
  items: ReminderItem[];
}

/** Today's calendar date in Nairobi as YYYY-MM-DD (FS BR-07). */
export function nairobiToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const day = (value: unknown) => (typeof value === 'string' && value ? value.slice(0, 10) : null);

/**
 * Dashboard reminders from FS section 9: overdue tasks, health and maintenance due within
 * the reminder window or past, items at or below reorder level, and this month's finance.
 * Finance is null when the caller has no finance rows (non-owners).
 */
export function buildReminders(
  data: { tasks: Row[]; health: Row[]; inventory: Row[]; equipment: Row[]; finance: Row[] | null },
  today: string,
  windowDays = 7,
): Reminders {
  const horizon = addDays(today, windowDays);
  const items: ReminderItem[] = [];

  const overdue = data.tasks.filter((task) => {
    const due = day(task['due_date']);
    return !!due && due < today && !['Completed', 'Cancelled'].includes(String(task['status']));
  });
  for (const task of overdue)
    items.push({
      title: String(task['title']),
      detail: `Task · ${task['assignee_name'] ?? 'Unassigned'}`,
      date: day(task['due_date'])!,
      overdue: true,
      route: '/tasks',
    });

  const health = data.health.filter((event) => {
    const due = day(event['next_due_date']);
    return !!due && due <= horizon;
  });
  for (const event of health) {
    const due = day(event['next_due_date'])!;
    items.push({
      title: `${event['type']} due`,
      detail: String(event['animal_label'] ?? 'Animal health'),
      date: due,
      overdue: due < today,
      route: '/health',
    });
  }

  const low = data.inventory.filter(
    (item) => Number(item['quantity']) <= Number(item['reorder_level']),
  );
  for (const item of low)
    items.push({
      title: `${item['name']} is low`,
      detail: `${Number(item['quantity'])} ${item['unit']} left, reorder at ${Number(item['reorder_level'])}`,
      date: today,
      overdue: false,
      route: '/inventory',
    });

  const service = data.equipment.filter((item) => {
    const due = day(item['next_service_date']);
    return !!due && due <= horizon;
  });
  for (const item of service) {
    const due = day(item['next_service_date'])!;
    items.push({
      title: `${item['name']} service`,
      detail: `Equipment · ${item['status']}`,
      date: due,
      overdue: due < today,
      route: '/equipment',
    });
  }

  let month: Reminders['month'] = null;
  if (data.finance) {
    const prefix = today.slice(0, 7);
    month = { income: 0, expenses: 0 };
    for (const row of data.finance) {
      if (day(row['transaction_date'])?.slice(0, 7) !== prefix) continue;
      if (row['type'] === 'Income') month.income += Number(row['amount_kes']);
      else month.expenses += Number(row['amount_kes']);
    }
  }

  items.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.date.localeCompare(b.date));
  return {
    overdueTasks: overdue.length,
    healthDue: health.length,
    lowStock: low.length,
    maintenanceDue: service.length,
    month,
    items,
  };
}
