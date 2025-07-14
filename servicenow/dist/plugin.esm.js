import { createPlugin, createRoutableExtension, createComponentExtension } from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes.esm.js';

const myPluginPlugin = createPlugin({
  id: "my-plugin",
  routes: {
    root: rootRouteRef
  }
});
const ServiceNowPage = myPluginPlugin.provide(
  createRoutableExtension({
    name: "ServiceNowPage",
    component: () => import('./components/ServiceNowPage.esm.js').then((m) => m.ServiceNowPage),
    mountPoint: rootRouteRef
  })
);
const EntityServiceNowContent = myPluginPlugin.provide(
  createComponentExtension({
    name: "EntityServiceNowContent",
    component: {
      lazy: () => import('./components/ServiceNowEntityWidget.esm.js').then((m) => m.ServiceNowEntityWidget)
    }
  })
);

export { EntityServiceNowContent, ServiceNowPage, myPluginPlugin, rootRouteRef };
//# sourceMappingURL=plugin.esm.js.map
