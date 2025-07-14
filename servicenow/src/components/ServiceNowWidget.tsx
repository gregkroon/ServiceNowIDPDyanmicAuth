import { useState } from 'react';
import {
  Table,
  TableColumn,
  Progress,
  StatusOK,
  StatusError,
  StatusWarning,
  StatusAborted,
} from '@backstage/core-components';
import { useApi, identityApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import { useAsync } from 'react-use';
import { Alert } from '@material-ui/lab';

const SERVICENOW_INSTANCE_URL = 'https://ven03172.service-now.com';

export type Incident = {
  sys_id: string;
  number: string;
  short_description: string;
  state: string;
  priority: string;
  opened_at: string;
};

// Helper component to show priority visually
const PriorityStatus = ({ priority }: { priority: string }) => {
  switch (priority) {
    case '1':
      return <StatusError>1 - Critical</StatusError>;
    case '2':
      return <StatusWarning>2 - High</StatusWarning>;
    case '3':
      return <StatusOK>3 - Moderate</StatusOK>;
    default:
      return <StatusAborted>{priority} - Low</StatusAborted>;
  }
};

const columns: TableColumn<Incident>[] = [
  {
    title: 'Number',
    field: 'number',
    width: '10%',
    render: rowData => (
      <a
        href={`${SERVICENOW_INSTANCE_URL}/nav_to.do?uri=incident.do?sys_id=${rowData.sys_id}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {rowData.number}
      </a>
    ),
  },
  { title: 'Description', field: 'short_description' },
  { title: 'State', field: 'state', width: '10%' },
  {
    title: 'Priority',
    field: 'priority',
    width: '15%',
    render: rowData => <PriorityStatus priority={rowData.priority} />,
  },
  { title: 'Opened At', field: 'opened_at', type: 'datetime' },
];

type ServiceNowWidgetProps = {
  stateFilter: string;
  descriptionFilter: string;
};

export const ServiceNowWidget = (props: ServiceNowWidgetProps) => {
  const { stateFilter, descriptionFilter } = props;
  const identityApi = useApi(identityApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  // State for managing table pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const { value, loading, error } = useAsync(
    async (): Promise<{ incidents: Incident[]; totalCount: number }> => {
      const { token } = await identityApi.getCredentials();
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      
      // Build the query string dynamically from the filter props
      let query = stateFilter;
      if (descriptionFilter) {
        query += `^short_descriptionLIKE${descriptionFilter}`;
      }

      const fields = 'sys_id,number,short_description,state,priority,opened_at';
      const offset = page * pageSize; // Calculate offset for pagination

      const url = `${proxyBaseUrl}/servicenow/api/now/table/incident?sysparm_query=${query}&sysparm_fields=${fields}&sysparm_limit=${pageSize}&sysparm_offset=${offset}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText} - ${text}`);
      }

      // Get total number of records from response header for pagination
      const totalCount = parseInt(response.headers.get('X-Total-Count') || '0', 10);
      const data = (await response.json()) as { result?: Incident[] };

      return { incidents: data.result ?? [], totalCount };
    },
    [identityApi, discoveryApi, stateFilter, descriptionFilter, page, pageSize],
  );

  return (
    <>
      {loading && <Progress />}
      {error && <Alert severity="error">{error.message}</Alert>}
      {!loading && !error && (
        <Table
          title="Incidents"
          options={{ search: false, paging: true, pageSize }}
          columns={columns}
          data={value?.incidents || []}
          page={page}
          totalCount={value?.totalCount || 0}
          onPageChange={setPage}
          onRowsPerPageChange={setPageSize}
        />
      )}
    </>
  );
};