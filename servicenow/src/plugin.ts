import {
  createPlugin,
  createRoutableExtension,
  createComponentExtension,
} from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';

export const myPluginPlugin = createPlugin({
  id: 'my-plugin',
  routes: {
    root: rootRouteRef,
  },
});

export const ServiceNowPage = myPluginPlugin.provide(
  createRoutableExtension({
    name: 'ServiceNowPage',
    component: () =>
      import('./components/ServiceNowPage').then(m => m.ServiceNowPage),
    mountPoint: rootRouteRef,
  }),
);

export const EntityServiceNowContent = myPluginPlugin.provide(
  createComponentExtension({
    name: 'EntityServiceNowContent',
    component: {
      lazy: () =>
        import('./components/ServiceNowEntityWidget').then(m => m.ServiceNowEntityWidget),
    },
  }),
);

export { rootRouteRef };

