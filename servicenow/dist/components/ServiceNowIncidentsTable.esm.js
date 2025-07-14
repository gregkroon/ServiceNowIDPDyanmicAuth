import { jsxs, jsx } from 'react/jsx-runtime';
import { InfoCard, Progress, Table, StatusAborted, StatusOK, StatusWarning, StatusError } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';

const SERVICENOW_INSTANCE_URL = "https://ven03172.service-now.com";
const PriorityStatus = ({ priority }) => {
  switch (priority) {
    case "1":
      return /* @__PURE__ */ jsx(StatusError, { children: "1 - Critical" });
    case "2":
      return /* @__PURE__ */ jsx(StatusWarning, { children: "2 - High" });
    case "3":
      return /* @__PURE__ */ jsx(StatusOK, { children: "3 - Moderate" });
    default:
      return /* @__PURE__ */ jsxs(StatusAborted, { children: [
        priority,
        " - Low"
      ] });
  }
};
const columns = [
  {
    title: "Number",
    field: "number",
    width: "10%",
    render: (rowData) => /* @__PURE__ */ jsx(
      "a",
      {
        href: `${SERVICENOW_INSTANCE_URL}/nav_to.do?uri=incident.do?sys_id=${rowData.sys_id}`,
        target: "_blank",
        rel: "noopener noreferrer",
        children: rowData.number
      }
    )
  },
  { title: "Description", field: "short_description" },
  { title: "State", field: "state", width: "10%" },
  {
    title: "Priority",
    field: "priority",
    width: "15%",
    render: (rowData) => /* @__PURE__ */ jsx(PriorityStatus, { priority: rowData.priority })
  },
  { title: "Opened At", field: "opened_at", type: "datetime" }
];
const ServiceNowIncidentsTable = (props) => {
  const {
    title,
    incidents,
    loading,
    error,
    page,
    onPageChange,
    pageSize,
    onRowsPerPageChange,
    totalCount
  } = props;
  return /* @__PURE__ */ jsxs(InfoCard, { children: [
    loading && /* @__PURE__ */ jsx(Progress, {}),
    error && /* @__PURE__ */ jsx(Alert, { severity: "error", children: error.message }),
    !loading && !error && /* @__PURE__ */ jsx(
      Table,
      {
        title,
        options: { search: false, paging: true, pageSize },
        columns,
        data: incidents,
        page,
        totalCount,
        onPageChange,
        onRowsPerPageChange
      }
    )
  ] });
};

export { ServiceNowIncidentsTable };
//# sourceMappingURL=ServiceNowIncidentsTable.esm.js.map
