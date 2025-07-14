import { jsx } from 'react/jsx-runtime';
import { useState } from 'react';
import { useApi, identityApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import { useAsync } from 'react-use';
import { ServiceNowIncidentsTable } from './ServiceNowIncidentsTable.esm.js';

const ServiceNowStandaloneWidget = (props) => {
  const { stateFilter, descriptionFilter } = props;
  const identityApi = useApi(identityApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const { value, loading, error } = useAsync(
    async () => {
      const { token } = await identityApi.getCredentials();
      const proxyBaseUrl = await discoveryApi.getBaseUrl("proxy");
      let query = stateFilter;
      if (descriptionFilter) {
        query += `^short_descriptionLIKE${descriptionFilter}`;
      }
      const fields = "sys_id,number,short_description,state,priority,opened_at";
      const offset = page * pageSize;
      const url = `${proxyBaseUrl}/servicenow/api/now/table/incident?sysparm_query=${query}&sysparm_fields=${fields}&sysparm_limit=${pageSize}&sysparm_offset=${offset}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText} - ${text}`);
      }
      const totalCount = parseInt(response.headers.get("X-Total-Count") || "0", 10);
      const data = await response.json();
      return { incidents: data.result ?? [], totalCount };
    },
    [identityApi, discoveryApi, stateFilter, descriptionFilter, page, pageSize]
  );
  return /* @__PURE__ */ jsx(
    ServiceNowIncidentsTable,
    {
      title: "Incidents",
      loading,
      error,
      incidents: value?.incidents || [],
      page,
      onPageChange: setPage,
      pageSize,
      onRowsPerPageChange: setPageSize,
      totalCount: value?.totalCount || 0
    }
  );
};

export { ServiceNowStandaloneWidget };
//# sourceMappingURL=ServiceNowStandaloneWidget.esm.js.map
