# ServiceNow Plugin for Harness IDP (Backstage)

This plugin provides a widget for the [Harness Internal Developer Portal (IDP)](https://developer.harness.io/docs/internal-developer-portal/) built on [Backstage](https://backstage.io/). It enables users to view, create, update, resolve, and close **ServiceNow Incidents and Change Requests** associated with a given software component.

---

## ✨ Features

* 🔐 **ServiceNow Basic Auth Login** (per-user session)
* 📋 View **Incidents** and **Change Requests** linked to a component via the CMDB `ci-sysid`
* 🔍 Filter and search by state and short description
* ➕ Create new Incidents or Change Requests
* ✏️ Update short descriptions
* ✅ Resolve or Close Incidents / Changes
* 👁 Open linked ServiceNow records in a new tab
* 🔄 Session expiration and re-authentication
* ⚠️ UI feedback for error handling, loading, and invalid states

---

## 📦 Installation

1. **Clone or copy the plugin** into your Backstage project.

2. Add the component to your plugin or entity page layout:

```ts
import { ServiceNowEntityWidget } from '../path-to-plugin/ServiceNowEntityWidget';

<EntityPageLayout>
  ...
  <EntityLayout.Route path="/servicenow" title="ServiceNow">
    <ServiceNowEntityWidget />
  </EntityLayout.Route>
  ...
</EntityPageLayout>
```

3. Add the required entity annotation to your software component in `catalog-info.yaml`:

```yaml
metadata:
  annotations:
    servicenow.com/ci-sysid: <your-cmdb-ci-sysid>
```

4. Add a proxy configuration to your `app-config.yaml`:

```yaml
proxy:
  '/servicenow':
    target: 'https://<your-instance>.service-now.com'
    changeOrigin: true
    secure: true
```

---

## 🔑 Authentication

The widget uses **Basic Auth**. Each user must log in with their ServiceNow credentials. Session expiration is handled with a 30-minute timeout.

> Credentials are **not stored** in persistent storage or cookies—only held in-memory during the session.

---

## 🧠 How it Works

* Uses the \[`cmdb_ci`] relationship to fetch incidents or changes for the linked Configuration Item.
* Switches between `incident` and `change_request` tables based on the UI tab selected.
* Fetches data via the Backstage proxy with pagination and filtering support.
* Exposes actions via menus and dialogs for:

  * Creating new items
  * Updating descriptions
  * Resolving (Incidents) / Closing (Changes)
  * Closing (Incidents) / Cancelling (Changes)

---

## 🧪 Example Usage

Once deployed and authenticated, a developer can:

1. See a list of open incidents related to the CI.
2. Click **Create Incident** to raise a new ticket.
3. Update ticket details inline.
4. Click **Resolve** or **Close** from the dropdown menu.
5. Switch to the **Changes** tab and manage change requests the same way.

---

## 📌 Dependencies

This plugin uses the following Backstage APIs and components:

* `@backstage/core-components`
* `@backstage/core-plugin-api`
* `@backstage/plugin-catalog-react`
* `@material-ui/core`
* `@material-ui/lab`
* `react-use`

---

## 🛡 Security Notes

* Ensure HTTPS is enforced for all ServiceNow proxy traffic.
* Do not log ServiceNow credentials.
* This plugin is intended for use in **trusted internal environments** only.

---

## 🛠 Future Improvements

* OAuth2 support via ServiceNow token endpoints
* Session refresh tokens or delegated auth
* Role-based visibility for certain actions
* SLA tracking and visual indicators

---

## 🤝 Contributing

Contributions are welcome! Please fork the repo and open a PR. For major changes, open an issue to discuss what you'd like to improve.

---

## 📃 License

MIT – see [LICENSE](./LICENSE) file.

