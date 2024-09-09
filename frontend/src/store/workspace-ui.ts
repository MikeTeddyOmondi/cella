import { config } from 'config';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Label } from '~/types/app';

type Column = {
  columnId: string;
  width: string;
  minimized: boolean;
  expandAccepted: boolean;
  expandIced: boolean;
  recentLabels: Label[];
  taskIds: string[];
};

type WorkspaceUIById = {
  [key: string]: { columns: Column[] };
};

interface WorkspaceUIState {
  workspaces: WorkspaceUIById;
  changeColumn: (workspaceId: string, columnId: string, column: Partial<Column>) => void;
  addNewColumn: (workspaceId: string, column: Column) => void;
}

const defaultColumnValues = {
  width: '19rem',
  minimized: false,
  expandAccepted: false,
  expandIced: false,
  recentLabels: [] as Label[],
  taskIds: [] as string[],
};

export const useWorkspaceUIStore = create<WorkspaceUIState>()(
  devtools(
    persist(
      immer((set) => ({
        workspaces: {},
        addNewColumn: (workspaceId: string, column: Column) => {
          set((state) => {
            const workspace = state.workspaces[workspaceId];
            if (!workspace) {
              state.workspaces[workspaceId] = {
                columns: [column],
              };
            } else {
              workspace.columns.push(column);
            }
          });
        },
        changeColumn: (workspaceId: string, columnId: string, newColumn: Partial<Column>) => {
          set((state) => {
            const workspace = state.workspaces[workspaceId];
            if (!workspace) return;

            const columnIndex = workspace.columns.findIndex((column) => column.columnId === columnId);
            if (columnIndex === -1) {
              // If the column doesn't exist, create a new one
              state.workspaces[workspaceId].columns.push({ columnId, ...defaultColumnValues, ...newColumn });
            } else {
              // If the column exists, update it
              const updatedColumn = {
                ...workspace.columns[columnIndex],
                ...newColumn,
              };
              state.workspaces[workspaceId].columns[columnIndex] = updatedColumn;
            }
          });
        },
      })),

      {
        version: 1,
        name: `${config.slug}-workspace-ui`,
        partialize: (state) => ({
          workspaces: state.workspaces,
        }),
        storage: createJSONStorage(() => localStorage),
      },
    ),
  ),
);
