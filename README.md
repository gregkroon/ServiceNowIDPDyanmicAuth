# ServiceNowAuth Plugin for Harness IDP

A plugin for the [Harness Internal Developer Portal (IDP)](https://developer.harness.io/docs/internal-developer-portal/) that integrates with **ServiceNow** to allow developers to view, create, update, resolve, and close Incidents and Change Requests associated with a service entity.

---

## 🚀 Features

- 🔐 Per-user Basic Authentication to ServiceNow
- 📋 View Incidents and Changes linked to a service’s CMDB CI
- 🔍 Search and filter by state and short description
- ➕ Create new Incidents or Change Requests
- ✏️ Edit short descriptions
- ✅ Resolve/Close Incidents or Changes
- 🔗 Deep-link to records in ServiceNow
- ⏱️ 30-minute session timeout for security
- ⚠️ Inline error feedback for API/authentication issues

---

## 🧩 Layout Configuration (Harness IDP UI)

To make your plugin visible in the Harness IDP UI:

### Tabs and Pages

| Type                | Name                     | Purpose                                           |
|---------------------|--------------------------|---------------------------------------------------|
| **Tab**             | `EntityServiceNowContent` | Appears under the service entity tab layout       |
| **Sidenav Page**    | `ServiceNowPage`          | Full-page experience via the side navigation      |

> These names must match the exports in your plugin code.

### Export Required in Plugin Code

```ts
export { ServiceNowEntityWidget as EntityServiceNowContent } from './ServiceNowEntityWidget';
export { ServiceNowEntityWidget as ServiceNowPage } from './ServiceNowEntityWidget';
````

---

## ⚙️ Plugin Metadata

| Field                 | Value                                                     |
| --------------------- | --------------------------------------------------------- |
| **Plugin Name**       | `ServicenowAuth`                                          |
| **Package Name**      | `@internal/plugin-my-plugin`                              |
| **Description**       | ServiceNow integration for managing Incidents and Changes |
| **Category**          | ITSM / Incident Management                                |
| **Created By**        | All Account Users                                         |
| **Plugin Applies To** | `Service`                                                 |

> Ensure your catalog entity includes the following annotation:

```yaml
metadata:
  annotations:
    servicenow.com/ci-sysid: <your-ci-sys-id>
```

---

## 🔐 Authentication

This plugin uses Basic Auth for each user. Upon login:

* Credentials are used in-memory only during the session
* No persistent storage is used
* Session expires after 30 minutes of inactivity

---

## 🌐 Proxy Configuration (Backstage)

To connect through the Backstage proxy, update your `app-config.yaml`:

```yaml
proxy:
  endpoints:
    /servicenow:
      target: https://yourinstance.service-now.com/
      credentials: dangerously-allow-unauthenticated
      allowedHeaders:
        - Authorization
        - Content-Type
        - Accept
      pathRewrite:
        api/proxy/servicenow/?: /
customPlugins:
  servicenow:
    instanceUrl: https://yourinstance.service-now.com/
```

---

## 🧠 How it Works

* Uses the ServiceNow REST API via the Backstage proxy
* Filters results by `cmdb_ci` sys\_id annotation
* Provides two views:

  * **Incidents** (`/table/incident`)
  * **Changes** (`/table/change_request`)
* Supports actions: **Create, Update, Resolve, Close**

---

## 🖥 Screenshots (Optional)

*Add screenshots here if desired.*


---

## 📃 License

MIT – see [LICENSE](./LICENSE)

```
