import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard').then((module) => module.Dashboard),
  },
  {
    path: 'documents',
    loadComponent: () => import('./documents/documents').then((module) => module.Documents),
  },
  {
    path: '',
    loadComponent: () => import('./transports').then((module) => module.Transports),
    children: [
      {
        path: 'shipments/:id',
        loadComponent: () => import('./shipment-details').then((module) => module.ShipmentDetails),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
