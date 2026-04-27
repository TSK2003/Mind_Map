import { CalendarDays, CheckCircle2, CircleDashed, Flame, Goal, KanbanSquare, ListChecks } from 'lucide-react';
import { useBrainStore } from '../store/useBrainStore';

const columns = ['backlog', 'active', 'blocked', 'done'] as const;

export function ProductivityDashboard() {
  const vault = useBrainStore((state) => state.vault);

  return (
    <div className="productivity-pane">
      <section className="dashboard-band">
        {vault.goals.map((goal) => (
          <article className="goal-card" key={goal.id}>
            <div>
              <Goal size={18} />
              <span>{goal.title}</span>
            </div>
            <div className="progress-bar">
              <span style={{ width: `${goal.progress}%` }} />
            </div>
            <strong>{goal.progress}%</strong>
          </article>
        ))}
      </section>
      <section className="kanban-board">
        <div className="section-title">
          <KanbanSquare size={19} />
          <h2>Projects</h2>
        </div>
        <div className="kanban-columns">
          {columns.map((column) => (
            <div className="kanban-column" key={column}>
              <div className="kanban-column-title">
                <span>{column}</span>
                <strong>{vault.tasks.filter((task) => task.status === column).length}</strong>
              </div>
              {vault.tasks
                .filter((task) => task.status === column)
                .map((task) => (
                  <article className={`task-card priority-${task.priority}`} key={task.id}>
                    <div>
                      {task.status === 'done' ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}
                      <span>{task.title}</span>
                    </div>
                    {task.dueDate ? <time>{task.dueDate}</time> : null}
                  </article>
                ))}
            </div>
          ))}
        </div>
      </section>
      <section className="habit-calendar-grid">
        <article className="habit-panel">
          <div className="section-title">
            <Flame size={19} />
            <h2>Habits</h2>
          </div>
          {vault.habits.map((habit) => (
            <div className="habit-row" key={habit.id}>
              <span>{habit.title}</span>
              <strong>{habit.streak}</strong>
            </div>
          ))}
        </article>
        <article className="calendar-panel">
          <div className="section-title">
            <CalendarDays size={19} />
            <h2>Focus Calendar</h2>
          </div>
          <div className="focus-slots">
            <span>Deep work</span>
            <span>Knowledge review</span>
            <span>Weekly planning</span>
          </div>
        </article>
        <article className="habit-panel">
          <div className="section-title">
            <ListChecks size={19} />
            <h2>Today</h2>
          </div>
          <div className="habit-row">
            <span>Open loops</span>
            <strong>{vault.tasks.filter((task) => task.status !== 'done').length}</strong>
          </div>
          <div className="habit-row">
            <span>Linked notes</span>
            <strong>{vault.relationships.length}</strong>
          </div>
        </article>
      </section>
    </div>
  );
}

