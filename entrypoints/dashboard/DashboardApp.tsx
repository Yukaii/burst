import React from 'react';
import ReactDOM from 'react-dom/client';
import { LeftSidebar } from './components/LeftSidebar';
import { EditorPanel } from './components/EditorPanel';
import { UpdatesPanel } from './components/UpdatesPanel';
import { GitRegistryPanel } from './components/GitRegistryPanel';
import { RegistryCommandPanel } from './components/RegistryCommandPanel';
import { EditorPrefModal } from './components/EditorPrefModal';
import { ConfirmModal } from './components/ConfirmModal';
import { TestHarnessModal } from './components/TestHarnessModal';
import { PermissionBanner } from './components/PermissionBanner';
import { useDashboard } from './components/useDashboard';
import './style.css';

export default function DashboardApp() {
  const d = useDashboard();

  if (d.loadState === 'loading') {
    return (
      <main className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
        <section className="text-sm font-semibold tracking-wider text-muted-foreground uppercase animate-pulse">Loading local scripts...</section>
      </main>
    );
  }

  if (d.loadState === 'error' || (!d.selectedScript && !d.selectedRegistryCommand)) {
    return (
      <main className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
        <section className="text-sm font-semibold text-destructive uppercase">{d.saveState}</section>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      {(d.isDraggingLeft || d.isDraggingRight) && <div className="drag-overlay" />}

      <LeftSidebar
        scripts={d.scripts} selectedId={d.selectedId} onSelect={d.navigateToScript}
        installedRegistryCommands={d.installedRegistryCommands}
        selectedRegistryCommandId={d.selectedRegistryCommandId}
        onSelectRegistryCommand={d.navigateToRegistryCommand}
        onCreateDraft={d.createDraft} onExportAll={d.exportScripts}
        onImport={() => {}}
        onToggleScriptStatus={(script) => void d.setScriptStatusDirectly(script, script.status === 'enabled' ? 'disabled' : 'enabled')}
        onToggleRegistryCommandStatus={(command) => void d.setRegistryCommandStatusDirectly(command, command.status === 'disabled' ? 'enabled' : 'disabled')}
        onToggleRegistryCommandPackStatus={(packId, status) => void d.setRegistryCommandPackStatusDirectly(packId, status)}
        onUninstallRegistryCommand={(commandId) => void d.uninstallOfficialRegistryCommand(commandId)}
        onUninstallRegistryCommandPack={(packId) => void d.uninstallOfficialRegistryCommandPack(packId)}
        onForkRegistryCommand={(command) => void d.forkOfficialRegistryCommand(command)}
        onExportScript={d.exportSingleScript}
        onDeleteScript={(script) => {
          d.setConfirmModal({
            open: true, title: 'Delete Script',
            message: <>Are you sure you want to delete script <strong>&quot;{script.name}&quot;</strong>? This action cannot be undone.</>,
            confirmText: 'Delete', isDestructive: true,
            onConfirm: async () => {
              const idx = d.scripts.findIndex(s => s.id === script.id);
              const nextScripts = d.scripts.filter(s => s.id !== script.id);
              const fallback = nextScripts.length > 0 ? undefined : d.createLocalScriptDraft();
              const finalScripts = fallback ? [fallback] : nextScripts;
              const nextSelection = (finalScripts[Math.max(0, idx - 1)] ?? finalScripts[0]).id;
              d.setScripts(finalScripts); d.navigateToScript(nextSelection);
              await d.persistScripts(finalScripts, fallback ? 'Deleted script and created a draft' : 'Deleted script');
            }
          });
        }}
        onAddRegistry={d.handleAddRegistry} onSelectGitView={d.navigateToGitView}
        activeTab={d.activeTab} onChangeTab={(tab) => {
          if (tab === 'editor') d.navigateToScript(d.selectedId ?? d.scripts[0]?.id);
          else d.navigateToGitView(d.selectedGitView);
        }}
        gitRegistries={d.gitRegistries} selectedGitView={d.selectedGitView}
        availableUpdates={d.availableUpdates}
        newRepoUrl={d.newRepoUrl} setNewRepoUrl={d.setNewRepoUrl} addError={d.addError}
        leftWidth={d.leftWidth} leftSidebarOpen={d.leftSidebarOpen}
        onToggleLeft={() => {
          d.setLeftSidebarOpen((o: boolean) => {
            const n = !o;
            localStorage.setItem('burst.dashboard.leftSidebarOpen', String(n));
            return n;
          });
        }}
        isDraggingLeft={d.isDraggingLeft} onStartLeftDrag={d.startLeftDrag}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {!d.hasUserScriptsPermission && <PermissionBanner />}

        {d.activeTab === 'editor' && d.selectedRegistryCommand ? (
          <RegistryCommandPanel
            command={d.selectedRegistryCommand}
            packCommands={d.installedRegistryCommands.filter((command) => command.packId && command.packId === d.selectedRegistryCommand?.packId)}
            leftSidebarOpen={d.leftSidebarOpen}
            onToggleLeft={() => {
              d.setLeftSidebarOpen((o: boolean) => {
                const n = !o;
                localStorage.setItem('burst.dashboard.leftSidebarOpen', String(n));
                return n;
              });
            }}
            saveState={d.saveState}
            editorFontFamily={d.editorFontFamily}
            editorFontSize={d.editorFontSize}
            onFork={() => void d.forkOfficialRegistryCommand(d.selectedRegistryCommand!)}
            onToggleStatus={() => void d.setRegistryCommandStatusDirectly(d.selectedRegistryCommand!, d.selectedRegistryCommand!.status === 'disabled' ? 'enabled' : 'disabled')}
            onTogglePackStatus={(status) => void d.setRegistryCommandPackStatusDirectly(d.selectedRegistryCommand!.packId!, status)}
            onUninstall={() => void d.uninstallOfficialRegistryCommand(d.selectedRegistryCommand!.id)}
            onUninstallPack={() => void d.uninstallOfficialRegistryCommandPack(d.selectedRegistryCommand!.packId!)}
          />
        ) : d.activeTab === 'editor' && d.selectedScript ? (
          <EditorPanel
            selectedScript={d.selectedScript} scripts={d.scripts}
            leftSidebarOpen={d.leftSidebarOpen}
            onToggleLeft={() => {
              d.setLeftSidebarOpen((o: boolean) => {
                const n = !o;
                localStorage.setItem('burst.dashboard.leftSidebarOpen', String(n));
                return n;
              });
            }}
            rightPanelOpen={d.rightPanelOpen}
            onToggleRight={() => {
              d.setRightPanelOpen((o: boolean) => {
                const n = !o;
                localStorage.setItem('burst.dashboard.rightPanelOpen', String(n));
                return n;
              });
            }}
            saveState={d.saveState} hasUnsavedChanges={d.hasUnsavedChanges}
            onSave={() => void d.saveSelectedScript('Saved')}
            onFormat={d.formatSelectedScript}
            onDelete={d.deleteSelectedScript}
            onUpdateScript={d.updateSelectedScript}
            onResetFork={() => void d.resetForkedScriptToUpstream(d.selectedScript!.id)}
            onUnlinkFork={() => void d.unlinkForkedScript(d.selectedScript!.id)}
            onOpenTestHarness={() => d.setTestHarnessOpen(true)}
            onOpenEditorPrefs={() => d.setEditorPrefModalOpen(true)}
            editorFontFamily={d.editorFontFamily} editorFontSize={d.editorFontSize}
            editorTheme={d.editorTheme} editorKeymap={d.editorKeymap}
            editorWordWrap={d.editorWordWrap} settings={d.settings}
            isDraggingRight={d.isDraggingRight} onStartRightDrag={d.startRightDrag}
          />
        ) : d.selectedGitView === 'updates' ? (
          <UpdatesPanel
            leftSidebarOpen={d.leftSidebarOpen}
            onToggleLeft={() => {
              d.setLeftSidebarOpen((o: boolean) => {
                const n = !o;
                localStorage.setItem('burst.dashboard.leftSidebarOpen', String(n));
                return n;
              });
            }}
            updateStatusText={d.updateStatusText} isCheckingUpdates={d.isCheckingUpdates}
            availableUpdates={d.availableUpdates}
            onCheckUpdates={() => void d.checkUpdates()}
            onUpdateAll={() => void d.handleUpdateAll()}
            onUpdateScript={(u) => void d.handleUpdateScript(u)}
            onMergeForkUpdate={(u) => void d.handleMergeForkUpdate(u)}
            onUnlinkUpdate={(u) => void d.handleUnlinkUpdate(u)}
          />
        ) : (
          (() => {
            const reg = d.gitRegistries.find(r => r.id === d.selectedGitView);
            if (!reg) return null;
            return (
              <GitRegistryPanel
                registry={reg} leftSidebarOpen={d.leftSidebarOpen}
                onToggleLeft={() => {
                  d.setLeftSidebarOpen((o: boolean) => {
                    const n = !o;
                    localStorage.setItem('burst.dashboard.leftSidebarOpen', String(n));
                    return n;
                  });
                }}
                scripts={d.scripts}
                onInstallCommand={(cmd, r) => void d.installGitCommand(cmd, r)}
                onRemoveRegistry={(id) => void d.handleRemoveRegistry(id)}
              />
            );
          })()
        )}
      </div>

      <EditorPrefModal
        open={d.editorPrefModalOpen} onClose={() => d.setEditorPrefModalOpen(false)}
        editorFontFamily={d.editorFontFamily} editorFontSize={d.editorFontSize}
        editorTheme={d.editorTheme} editorKeymap={d.editorKeymap}
        editorWordWrap={d.editorWordWrap}
        onUpdate={d.updateEditorSettings}
      />
      <ConfirmModal
        open={d.confirmModal.open} title={d.confirmModal.title}
        message={d.confirmModal.message} confirmText={d.confirmModal.confirmText}
        cancelText={d.confirmModal.cancelText} isDestructive={d.confirmModal.isDestructive}
        onConfirm={d.confirmModal.onConfirm}
        onClose={() => d.setConfirmModal(c => ({ ...c, open: false }))}
      />
      <TestHarnessModal
        open={d.testHarnessOpen} onClose={() => d.setTestHarnessOpen(false)}
        selectedScript={d.selectedScript}
        mockUrl={d.mockUrl} setMockUrl={d.setMockUrl}
        mockTitle={d.mockTitle} setMockTitle={d.setMockTitle}
        mockSelection={d.mockSelection} setMockSelection={d.setMockSelection}
        mockHtml={d.mockHtml} setMockHtml={d.setMockHtml}
        testOutput={d.testOutput} setTestOutput={d.setTestOutput}
      />
    </main>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

const dashboardWindow = window as Window & {
  __burstDashboardRoot?: ReturnType<typeof ReactDOM.createRoot>;
};

const dashboardRoot = dashboardWindow.__burstDashboardRoot ?? ReactDOM.createRoot(rootEl);
dashboardWindow.__burstDashboardRoot = dashboardRoot;

dashboardRoot.render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>,
);
