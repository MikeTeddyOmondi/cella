import { createContext, Fragment, useContext, useEffect, useMemo, useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable';
import { BoardColumn } from './board-column';
import { WorkspaceContext } from '../workspaces';
import type { Project } from '../common/root/electric';

interface ProjectContextValue {
  project: Project;
}

export const ProjectContext = createContext({} as ProjectContextValue);

export default function Board() {
  const { projects, tasks, searchQuery } = useContext(WorkspaceContext);
  const [innerProject, setInnerProject] = useState<Project[]>(projects || []);

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    return tasks.filter(
      (task) =>
        task.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.markdown?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.slug.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery, tasks]);

  useEffect(() => {
    setInnerProject(projects);
  }, [projects]);

  return (
    <div className="h-[calc(100vh-64px-64px)] transition md:h-[calc(100vh-88px)]">
      <ResizablePanelGroup direction="horizontal" className="flex gap-2" id="project-panels">
        {projects.map((project, index) => (
          <Fragment key={project.id}>
            <ResizablePanel key={`${project.id}-panel`}>
              <ProjectContext.Provider value={{ project }}>
                <BoardColumn tasks={filteredTasks.filter((t) => t.project_id === project.id)} key={`${project.id}-column`} />
              </ProjectContext.Provider>
            </ResizablePanel>
            {innerProject.length > index + 1 && (
              <ResizableHandle className="w-[6px] rounded border border-background -mx-[7px] bg-transparent hover:bg-primary/50 data-[resize-handle-state=drag]:bg-primary transition-all" />
            )}
          </Fragment>
        ))}
      </ResizablePanelGroup>
    </div>
  );
}
