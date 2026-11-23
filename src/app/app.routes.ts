import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./farm-workspace').then((module) => module.FarmWorkspace),
  },
  { path: 'farms', loadComponent: () => import('./farm-workspace').then((module) => module.FarmWorkspace) },
  { path: 'crops', loadComponent: () => import('./farm-workspace').then((module) => module.FarmWorkspace) },
  { path: 'livestock', loadComponent: () => import('./farm-workspace').then((module) => module.FarmWorkspace) },
  { path: 'fields', data: { module: 'fields' }, loadComponent: () => import('./farm-module').then((module) => module.FarmModule) },
  { path: 'inventory', data: { module: 'inventory' }, loadComponent: () => import('./farm-module').then((module) => module.FarmModule) },
  { path: 'tasks', data: { module: 'tasks' }, loadComponent: () => import('./farm-module').then((module) => module.FarmModule) },
  { path: 'equipment', data: { module: 'equipment' }, loadComponent: () => import('./farm-module').then((module) => module.FarmModule) },
  { path: 'finance', data: { module: 'finance' }, loadComponent: () => import('./farm-module').then((module) => module.FarmModule) },
  {
    path: 'documents',
    loadComponent: () => import('./documents/documents').then((module) => module.Documents),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
