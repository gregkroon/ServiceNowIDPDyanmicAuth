import * as react_jsx_runtime from 'react/jsx-runtime';
import * as _backstage_core_plugin_api from '@backstage/core-plugin-api';

declare const myPluginPlugin: _backstage_core_plugin_api.BackstagePlugin<{
    root: _backstage_core_plugin_api.RouteRef<undefined>;
}, {}, {}>;
declare const ServiceNowPage: () => react_jsx_runtime.JSX.Element;
declare const EntityServiceNowContent: () => react_jsx_runtime.JSX.Element;

export { EntityServiceNowContent, ServiceNowPage, myPluginPlugin };
