import chalk from 'chalk';
import { organizationsAndMembersSeed } from '.';

import { TaskView, renderWithTask } from 'hanji';

class Spinner {
  private offset = 0;
  private readonly iterator: () => void;

  constructor(private readonly frames: string[]) {
    this.iterator = () => {
      this.offset += 1;
      this.offset %= frames.length - 1;
    };
  }

  public tick = () => {
    this.iterator();
  };

  public value = () => {
    return this.frames[this.offset];
  };
}

type ValueOf<T> = T[keyof T];
export type Status = 'inserting' | 'done';
export type Stage = 'users' | 'organizations' | 'workspaces' | 'projects' | 'tasks' | 'labels' | 'relations';
type State = {
  [key in Stage]: {
    count: number;
    name: string;
    status: Status;
  };
};

export class Progress extends TaskView {
  private readonly spinner: Spinner = new Spinner('⣷⣯⣟⡿⢿⣻⣽⣾'.split(''));
  private timeout: NodeJS.Timeout | undefined;

  private state: State = {
    organizations: {
      count: 0,
      name: 'organizations',
      status: 'inserting',
    },
    users: {
      count: 0,
      name: 'users',
      status: 'inserting',
    },
    workspaces: {
      count: 0,
      name: 'workspaces',
      status: 'inserting',
    },
    projects: {
      count: 0,
      name: 'projects',
      status: 'inserting',
    },
    tasks: {
      count: 0,
      name: 'tasks',
      status: 'inserting',
    },
    labels: {
      count: 0,
      name: 'labels',
      status: 'inserting',
    },
    relations: {
      count: 0,
      name: 'relations',
      status: 'inserting',
    },
  };

  constructor() {
    super();
    this.timeout = setInterval(() => {
      this.spinner.tick();
      this.requestLayout();
    }, 128);

    this.on('detach', () => clearInterval(this.timeout));
  }

  public update(stage: Stage, count: number, status: Status) {
    this.state[stage].count = count;
    this.state[stage].status = status;
    this.requestLayout();
  }

  private formatCount = (count: number) => {
    const width: number = Math.max.apply(
      null,
      Object.values(this.state).map((it) => it.count.toFixed(0).length),
    );

    return count.toFixed(0).padEnd(width, ' ');
  };

  private statusText = (spinner: string, stage: ValueOf<State>) => {
    const { name, count } = stage;
    const isDone = stage.status === 'done';

    const prefix = isDone ? `[${chalk.green('✓')}]` : `[${spinner}]`;

    const formattedCount = this.formatCount(count);
    const suffix = isDone ? `${formattedCount} ${name} inserted` : `${formattedCount} ${name} inserting`;

    return `${prefix} ${suffix}\n`;
  };

  render(): string {
    let info = '';
    const spin = this.spinner.value();
    info += this.statusText(spin, this.state.organizations);
    info += this.statusText(spin, this.state.users);
    info += this.statusText(spin, this.state.workspaces);
    info += this.statusText(spin, this.state.projects);
    info += this.statusText(spin, this.state.tasks);
    info += this.statusText(spin, this.state.labels);
    info += this.statusText(spin, this.state.relations);
    return info;
  }
}

const progress = new Progress();
renderWithTask(
  progress,
  organizationsAndMembersSeed((stage, count, status) => {
    progress.update(stage, count, status);
  })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => process.exit(0)),
);
