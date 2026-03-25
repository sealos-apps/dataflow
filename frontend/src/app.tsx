/*
 * Copyright 2026 Clidey, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Toaster} from "@clidey/ux";
import {useEffect} from "react";
import {Navigate, Route, Routes} from "react-router-dom";
import {getRoutes, InternalRoutes, PrivateRoute, PublicRoutes} from './config/routes';
import {useAppDispatch, useAppSelector} from "./store/hooks";
import {useThemeCustomization} from "./hooks/use-theme-customization";
import {useSidebarShortcuts} from "./hooks/useSidebarShortcuts";
import {TourProvider} from "./components/tour/tour-provider";
import {useKeyboardShortcutsHelp} from "./components/keyboard-shortcuts-help";
import {useCommandPalette} from "./components/command-palette";
import {healthCheckService} from "./services/health-check";
import {ServerDownOverlay, DatabaseDownOverlay} from "./components/health/health-overlays";
import {HealthActions} from "./store/health";

export const App = () => {
    const dispatch = useAppDispatch();

  // Apply UI customization settings
  useThemeCustomization();

  // Setup keyboard shortcuts help modal (? key)
  const { KeyboardShortcutsHelpModal } = useKeyboardShortcutsHelp();

  // Setup command palette (Cmd+K)
  const { CommandPaletteModal } = useCommandPalette();

  // Setup sidebar navigation shortcuts (Ctrl+1-4 on Mac, Alt+1-4 on Windows/Linux, Cmd/Ctrl+B)
  useSidebarShortcuts();

  // Start health check service when user logs in, stop when they log out
  const authStatus = useAppSelector(state => state.auth.status);

  useEffect(() => {
    if (authStatus === 'logged-in') {
      healthCheckService.start();
    } else {
      healthCheckService.stop();
      // Reset health state when logged out
      dispatch(HealthActions.resetHealth());
    }

    return () => {
      healthCheckService.stop();
    };
  }, [authStatus, dispatch]);

  return (
    <TourProvider>
      <div className="h-[100vh] w-[100vw]" id="whodb-app-container">
        <Toaster />
        {KeyboardShortcutsHelpModal}
        {CommandPaletteModal}
        <ServerDownOverlay />
        <DatabaseDownOverlay />
        <Routes>
          <Route path="/" element={<PrivateRoute />}>
            {getRoutes().map(route => (
              <Route key={route.path} path={route.path} element={route.component} />
            ))}
            <Route path="/" element={<Navigate to={InternalRoutes.Dashboard.StorageUnit.path} replace />} />
          </Route>
          <Route path={PublicRoutes.Login.path} element={PublicRoutes.Login.component} />
        </Routes>
      </div>
    </TourProvider>
  );
}
