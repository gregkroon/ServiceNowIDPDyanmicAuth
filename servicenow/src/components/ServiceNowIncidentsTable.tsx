import {
  InfoCard,
  Table,
  TableColumn,
  Progress,
  StatusOK,
  StatusError,
  StatusWarning,
  StatusAborted,
} from '@backstage/core-components';
import { Alert } from '@material-ui/lab';

const SERVICENOW_INSTANCE_URL = 'https://ven03172.service-now.com';

// This definition is now exported to be shared
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

type ServiceNowIncidentsTableProps = {
  title: string;
  incidents: Incident[];
  loading: boolean;
  error?: Error;
  // Pagination props
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onRowsPerPageChange: (pageSize: number) => void;
  totalCount: number;
};

export const ServiceNowIncidentsTable = (props: ServiceNowIncidentsTableProps) => {
  const {
    title,
    incidents,
    loading,
    error,
    page,
    onPageChange,
    pageSize,
    onRowsPerPageChange,
    totalCount,
  } = props;

  return (
    <InfoCard>
      {loading && <Progress />}
      {error && <Alert severity="error">{error.message}</Alert>}
      {!loading && !error && (
        <Table
          title={title}
          options={{ search: false, paging: true, pageSize }}
          columns={columns}
          data={incidents}
          page={page}
          totalCount={totalCount}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
        />
      )}
    </InfoCard>
  );
};
