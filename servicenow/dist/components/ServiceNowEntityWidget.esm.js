import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import React, { useState } from 'react';
import { useDebounce, useAsync } from 'react-use';
import { InfoCard, Progress, Table, StatusAborted, StatusOK, StatusWarning, StatusError } from '@backstage/core-components';
import { useApi, discoveryApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Alert } from '@material-ui/lab';
import { Grid, Button, Dialog, DialogTitle, DialogContent, DialogContentText, TextField, DialogActions, ButtonGroup, FormControl, InputLabel, Select, MenuItem, Menu, IconButton, Chip } from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';

const SERVICENOW_INSTANCE_URL = "https://ven03172.service-now.com";
const SERVICENOW_CI_SYSID_ANNOTATION = "servicenow.com/ci-sysid";
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
const RiskStatus = ({ risk }) => {
  switch (risk) {
    case "1":
      return /* @__PURE__ */ jsx(StatusError, { children: "High" });
    case "2":
      return /* @__PURE__ */ jsx(StatusWarning, { children: "Medium" });
    case "3":
      return /* @__PURE__ */ jsx(StatusOK, { children: "Low" });
    default:
      return /* @__PURE__ */ jsx(StatusAborted, { children: "Unknown" });
  }
};
const ChangeStateChip = ({ state }) => {
  const stateMap = {
    "-5": { label: "New", color: "primary" },
    "-4": { label: "Assess", color: "secondary" },
    "-3": { label: "Authorize", color: "secondary" },
    "-2": { label: "Scheduled", color: "primary" },
    "-1": { label: "Implement", color: "secondary" },
    "0": { label: "Review", color: "secondary" },
    "3": { label: "Closed", color: "default" },
    "4": { label: "Cancelled", color: "default" }
  };
  const stateInfo = stateMap[state] || { label: state, color: "default" };
  return /* @__PURE__ */ jsx(Chip, { label: stateInfo.label, color: stateInfo.color, size: "small" });
};
const ServiceNowEntityWidget = () => {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const [viewType, setViewType] = useState("incidents");
  const [stateFilter, setStateFilter] = useState("active=true");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [debouncedDescriptionFilter, setDebouncedDescriptionFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [refreshCount, setRefreshCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingMenuItem, setPendingMenuItem] = useState(null);
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPriority, setNewItemPriority] = useState("3");
  const [newChangeRisk, setNewChangeRisk] = useState("3");
  const [newChangeStartDate, setNewChangeStartDate] = useState("");
  const [newChangeEndDate, setNewChangeEndDate] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [menuPosition, setMenuPosition] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [authState, setAuthState] = useState({
    username: "",
    password: "",
    isAuthenticated: false,
    authError: null,
    lastActivity: Date.now()
  });
  const [tempUsername, setTempUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const SESSION_TIMEOUT = 30 * 60 * 1e3;
  useDebounce(() => {
    setDebouncedDescriptionFilter(descriptionInput);
  }, 500, [descriptionInput]);
  React.useEffect(() => {
    if (authState.isAuthenticated) {
      const timeout = setTimeout(() => {
        setAuthState((prev) => ({
          ...prev,
          isAuthenticated: false,
          authError: "Session expired. Please login again."
        }));
      }, SESSION_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [authState.isAuthenticated]);
  const ciSysId = entity.metadata.annotations?.[SERVICENOW_CI_SYSID_ANNOTATION] ?? "";
  const createAuthHeader = () => {
    if (!authState.username || !authState.password) {
      throw new Error("ServiceNow credentials are required");
    }
    const credentials = `${authState.username}:${authState.password}`;
    const encodedCredentials = btoa(credentials);
    return `Basic ${encodedCredentials}`;
  };
  const isAuthError = (response) => {
    return response.status === 401 || response.status === 403;
  };
  const handleAuthError = () => {
    setAuthState((prev) => ({
      username: "",
      password: "",
      isAuthenticated: false,
      authError: "Authentication failed. Please check your credentials.",
      lastActivity: Date.now()
    }));
    setDialogOpen("login");
  };
  const handleLogin = () => {
    console.log("handleLogin called with:", { username: tempUsername, hasPassword: !!tempPassword });
    setAuthState({
      username: tempUsername,
      password: tempPassword,
      isAuthenticated: true,
      authError: null
    });
    setTempUsername("");
    setTempPassword("");
    setDialogOpen(null);
    setRefreshCount((c) => c + 1);
  };
  const handleLogout = () => {
    setAuthState({
      username: "",
      password: "",
      isAuthenticated: false,
      authError: null
    });
  };
  const { value, loading, error } = useAsync(
    async () => {
      if (!ciSysId) return null;
      if (!authState.isAuthenticated) return null;
      const proxyBaseUrl = await discoveryApi.getBaseUrl("proxy");
      const table = viewType === "incidents" ? "incident" : "change_request";
      let queryParts = [`cmdb_ci=${ciSysId}`];
      if (stateFilter) queryParts.push(stateFilter);
      if (debouncedDescriptionFilter) queryParts.push(`short_descriptionLIKE${debouncedDescriptionFilter}`);
      const query = queryParts.join("^");
      const fields = viewType === "incidents" ? "sys_id,number,short_description,state,priority,opened_at" : "sys_id,number,short_description,state,priority,risk,start_date,end_date";
      const offset = page * pageSize;
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}?sysparm_query=${query}&sysparm_fields=${fields}&sysparm_limit=${pageSize}&sysparm_offset=${offset}`;
      const response = await fetch(url, {
        headers: {
          "Authorization": createAuthHeader(),
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });
      if (isAuthError(response)) {
        handleAuthError();
        return null;
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText} - ${text}`);
      }
      const totalCount = parseInt(response.headers.get("X-Total-Count") || "0", 10);
      const data = await response.json();
      return { items: data.result ?? [], totalCount };
    },
    [discoveryApi, ciSysId, authState.isAuthenticated, authState.username, authState.password, stateFilter, debouncedDescriptionFilter, page, pageSize, refreshCount, viewType]
  );
  const handleAction = async (action) => {
    setActionError(null);
    try {
      await action();
      setRefreshCount((c) => c + 1);
      return true;
    } catch (e) {
      setActionError(new Error("Operation failed. Please try again."));
      return false;
    }
  };
  const sendApiRequest = async (url, options) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        "Authorization": createAuthHeader(),
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    if (isAuthError(response)) {
      handleAuthError();
      throw new Error("Authentication failed");
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        const text = await response.text();
        throw new Error(`Authentication error: ${response.status} - ${text}`);
      }
      throw new Error("Request failed. Please try again.");
    }
  };
  const handleCreateItem = async () => {
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl("proxy");
      const table = viewType === "incidents" ? "incident" : "change_request";
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}`;
      const baseData = {
        short_description: newItemDescription,
        cmdb_ci: ciSysId,
        priority: newItemPriority
      };
      const requestData = viewType === "incidents" ? baseData : {
        ...baseData,
        risk: newChangeRisk,
        start_date: newChangeStartDate,
        end_date: newChangeEndDate
      };
      await sendApiRequest(url, {
        method: "POST",
        body: JSON.stringify(requestData)
      });
    });
    if (success) {
      setDialogOpen(null);
      setNewItemDescription("");
      setNewItemPriority("3");
      setNewChangeRisk("3");
      setNewChangeStartDate("");
      setNewChangeEndDate("");
    }
  };
  const handleUpdateItem = async () => {
    if (!selectedItem) return;
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl("proxy");
      const table = viewType === "incidents" ? "incident" : "change_request";
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}/${selectedItem.sys_id}`;
      await sendApiRequest(url, {
        method: "PATCH",
        body: JSON.stringify({ short_description: newItemDescription })
      });
    });
    if (success) setDialogOpen(null);
  };
  const handleResolveItem = async () => {
    if (!selectedItem) return;
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl("proxy");
      const table = viewType === "incidents" ? "incident" : "change_request";
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}/${selectedItem.sys_id}`;
      const resolveState = viewType === "incidents" ? "6" : "3";
      await sendApiRequest(url, {
        method: "PATCH",
        body: JSON.stringify({ state: resolveState, close_notes: actionNotes })
      });
    });
    if (success) setDialogOpen(null);
  };
  const handleCloseItem = async () => {
    if (!selectedItem) return;
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl("proxy");
      const table = viewType === "incidents" ? "incident" : "change_request";
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}/${selectedItem.sys_id}`;
      const closeState = viewType === "incidents" ? "7" : "4";
      await sendApiRequest(url, {
        method: "PATCH",
        body: JSON.stringify({ state: closeState, close_notes: actionNotes })
      });
    });
    if (success) setDialogOpen(null);
  };
  const openDialog = (type, item) => {
    setSelectedItem(item);
    setNewItemDescription(item.short_description || "");
    setActionNotes("");
    setDialogOpen(type);
    setMenuPosition(null);
    setPendingMenuItem(null);
  };
  const getStateFilterOptions = () => {
    if (viewType === "incidents") {
      return [
        { value: "active=true", label: "Active" },
        { value: "state=6", label: "Resolved" },
        { value: "state=7", label: "Closed" },
        { value: "", label: "All" }
      ];
    } else {
      return [
        { value: "active=true", label: "Active" },
        { value: "state=3", label: "Closed" },
        { value: "state=4", label: "Cancelled" },
        { value: "", label: "All" }
      ];
    }
  };
  const getColumns = () => {
    const baseColumns = [
      {
        title: "Number",
        field: "number",
        width: "10%",
        render: (rowData) => /* @__PURE__ */ jsx(
          "a",
          {
            href: `${SERVICENOW_INSTANCE_URL}/nav_to.do?uri=${viewType === "incidents" ? "incident" : "change_request"}.do?sys_id=${rowData.sys_id}`,
            target: "_blank",
            rel: "noopener noreferrer",
            children: rowData.number
          }
        )
      },
      { title: "Description", field: "short_description" },
      {
        title: "State",
        field: "state",
        width: "10%",
        render: (rowData) => viewType === "changes" ? /* @__PURE__ */ jsx(ChangeStateChip, { state: rowData.state }) : rowData.state
      },
      {
        title: "Priority",
        field: "priority",
        width: "15%",
        render: (rowData) => /* @__PURE__ */ jsx(PriorityStatus, { priority: rowData.priority })
      }
    ];
    if (viewType === "incidents") {
      baseColumns.push({ title: "Opened At", field: "opened_at", type: "datetime" });
    } else {
      baseColumns.push(
        {
          title: "Risk",
          field: "risk",
          width: "10%",
          render: (rowData) => /* @__PURE__ */ jsx(RiskStatus, { risk: rowData.risk })
        },
        { title: "Start Date", field: "start_date", type: "datetime" },
        { title: "End Date", field: "end_date", type: "datetime" }
      );
    }
    baseColumns.push({
      title: "Actions",
      field: "actions",
      width: "5%",
      render: (rowData) => /* @__PURE__ */ jsx(
        IconButton,
        {
          "aria-label": "more",
          onClick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuPosition({ top: e.clientY, left: e.clientX });
            setPendingMenuItem(rowData);
          },
          children: /* @__PURE__ */ jsx(MoreVertIcon, {})
        }
      )
    });
    return baseColumns;
  };
  const handleViewTypeChange = (newViewType) => {
    setViewType(newViewType);
    setPage(0);
    setStateFilter("active=true");
    setDescriptionInput("");
    setDebouncedDescriptionFilter("");
  };
  if (!ciSysId) {
    return /* @__PURE__ */ jsx(InfoCard, { title: "ServiceNow Integration", children: /* @__PURE__ */ jsx(Alert, { severity: "warning", children: "No ServiceNow CI System ID found. Please add the annotation 'servicenow.com/ci-sysid' to your entity." }) });
  }
  if (!authState.isAuthenticated) {
    console.log("Rendering login prompt, dialogOpen:", dialogOpen);
    return /* @__PURE__ */ jsxs(InfoCard, { title: "ServiceNow Integration", children: [
      /* @__PURE__ */ jsxs(Grid, { container: true, spacing: 2, direction: "column", alignItems: "center", children: [
        /* @__PURE__ */ jsx(Grid, { item: true, children: /* @__PURE__ */ jsx(Alert, { severity: "info", children: "Please login to ServiceNow to view incidents and changes." }) }),
        authState.authError && /* @__PURE__ */ jsx(Grid, { item: true, children: /* @__PURE__ */ jsx(Alert, { severity: "error", children: authState.authError }) }),
        /* @__PURE__ */ jsx(Grid, { item: true, children: /* @__PURE__ */ jsx(
          Button,
          {
            variant: "contained",
            color: "primary",
            onClick: () => {
              console.log("Login button clicked, current dialogOpen:", dialogOpen);
              setDialogOpen("login");
              console.log("Set dialogOpen to login");
            },
            children: "Login to ServiceNow"
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs(
        Dialog,
        {
          open: dialogOpen === "login",
          onClose: () => {
            console.log("Dialog close triggered");
            setDialogOpen(null);
            setTempUsername("");
            setTempPassword("");
            setAuthState((prev) => ({ ...prev, authError: null }));
          },
          maxWidth: "sm",
          fullWidth: true,
          children: [
            /* @__PURE__ */ jsx(DialogTitle, { children: "ServiceNow Login" }),
            /* @__PURE__ */ jsxs(DialogContent, { children: [
              /* @__PURE__ */ jsx(DialogContentText, { children: "Please enter your ServiceNow credentials to access incidents and changes." }),
              authState.authError && /* @__PURE__ */ jsx(Alert, { severity: "error", style: { marginBottom: "16px" }, children: authState.authError }),
              /* @__PURE__ */ jsx(
                TextField,
                {
                  autoFocus: true,
                  margin: "dense",
                  label: "Username",
                  type: "text",
                  fullWidth: true,
                  value: tempUsername,
                  onChange: (e) => setTempUsername(e.target.value),
                  onKeyPress: (e) => {
                    if (e.key === "Enter" && tempUsername && tempPassword) {
                      handleLogin();
                    }
                  }
                }
              ),
              /* @__PURE__ */ jsx(
                TextField,
                {
                  margin: "dense",
                  label: "Password",
                  type: "password",
                  fullWidth: true,
                  value: tempPassword,
                  onChange: (e) => setTempPassword(e.target.value),
                  onKeyPress: (e) => {
                    if (e.key === "Enter" && tempUsername && tempPassword) {
                      handleLogin();
                    }
                  }
                }
              )
            ] }),
            /* @__PURE__ */ jsxs(DialogActions, { children: [
              /* @__PURE__ */ jsx(Button, { onClick: () => {
                console.log("Cancel button clicked");
                setDialogOpen(null);
                setTempUsername("");
                setTempPassword("");
                setAuthState((prev) => ({ ...prev, authError: null }));
              }, children: "Cancel" }),
              /* @__PURE__ */ jsx(
                Button,
                {
                  onClick: handleLogin,
                  color: "primary",
                  variant: "contained",
                  disabled: !tempUsername || !tempPassword,
                  children: "Login"
                }
              )
            ] })
          ]
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsxs(InfoCard, { title: "ServiceNow", children: [
    /* @__PURE__ */ jsxs(Grid, { container: true, spacing: 2, direction: "column", children: [
      /* @__PURE__ */ jsx(Grid, { item: true, children: /* @__PURE__ */ jsxs(Grid, { container: true, spacing: 2, alignItems: "center", justifyContent: "space-between", children: [
        /* @__PURE__ */ jsx(Grid, { item: true, children: /* @__PURE__ */ jsxs(ButtonGroup, { variant: "contained", color: "primary", children: [
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: viewType === "incidents" ? "contained" : "outlined",
              onClick: () => handleViewTypeChange("incidents"),
              children: "Incidents"
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: viewType === "changes" ? "contained" : "outlined",
              onClick: () => handleViewTypeChange("changes"),
              children: "Changes"
            }
          )
        ] }) }),
        /* @__PURE__ */ jsx(Grid, { item: true, children: /* @__PURE__ */ jsxs(Grid, { container: true, spacing: 1, children: [
          /* @__PURE__ */ jsx(Grid, { item: true, children: /* @__PURE__ */ jsxs(Button, { variant: "contained", color: "primary", onClick: () => setDialogOpen("create"), children: [
            "Create ",
            viewType === "incidents" ? "Incident" : "Change"
          ] }) }),
          /* @__PURE__ */ jsx(Grid, { item: true, children: /* @__PURE__ */ jsx(Button, { variant: "outlined", onClick: handleLogout, children: "Logout" }) })
        ] }) })
      ] }) }),
      /* @__PURE__ */ jsx(Grid, { item: true, children: /* @__PURE__ */ jsxs(Grid, { container: true, spacing: 2, children: [
        /* @__PURE__ */ jsx(Grid, { item: true, xs: 12, md: 6, children: /* @__PURE__ */ jsx(
          TextField,
          {
            fullWidth: true,
            label: "Search Description",
            variant: "outlined",
            value: descriptionInput,
            onChange: (e) => setDescriptionInput(e.target.value)
          }
        ) }),
        /* @__PURE__ */ jsx(Grid, { item: true, xs: 12, md: 6, children: /* @__PURE__ */ jsxs(FormControl, { fullWidth: true, variant: "outlined", children: [
          /* @__PURE__ */ jsx(InputLabel, { children: "State" }),
          /* @__PURE__ */ jsx(Select, { value: stateFilter, onChange: (e) => setStateFilter(e.target.value), label: "State", children: getStateFilterOptions().map((option) => /* @__PURE__ */ jsx(MenuItem, { value: option.value, children: option.label }, option.value)) })
        ] }) })
      ] }) }),
      /* @__PURE__ */ jsxs(Grid, { item: true, children: [
        loading && /* @__PURE__ */ jsx(Progress, {}),
        error && /* @__PURE__ */ jsx(Alert, { severity: "error", children: error.message }),
        actionError && /* @__PURE__ */ jsx(Alert, { severity: "error", children: actionError.message }),
        !loading && !error && value && /* @__PURE__ */ jsx(
          Table,
          {
            columns: getColumns(),
            data: value.items,
            options: { search: false, paging: true, pageSize: 5, padding: "dense" },
            page,
            totalCount: value.totalCount,
            onPageChange: setPage,
            onRowsPerPageChange: setPageSize
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      Menu,
      {
        open: Boolean(menuPosition),
        onClose: () => {
          setMenuPosition(null);
          setPendingMenuItem(null);
        },
        anchorReference: "anchorPosition",
        anchorPosition: menuPosition ?? void 0,
        keepMounted: true,
        children: [
          /* @__PURE__ */ jsx(MenuItem, { onClick: () => pendingMenuItem && openDialog("update", pendingMenuItem), children: "Update" }),
          /* @__PURE__ */ jsx(MenuItem, { onClick: () => pendingMenuItem && openDialog("resolve", pendingMenuItem), children: viewType === "incidents" ? "Resolve" : "Close" }),
          /* @__PURE__ */ jsx(MenuItem, { onClick: () => pendingMenuItem && openDialog("close", pendingMenuItem), children: viewType === "incidents" ? "Close" : "Cancel" })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(Dialog, { open: dialogOpen === "create", onClose: () => setDialogOpen(null), maxWidth: "md", fullWidth: true, children: [
      /* @__PURE__ */ jsxs(DialogTitle, { children: [
        "Create New ",
        viewType === "incidents" ? "Incident" : "Change"
      ] }),
      /* @__PURE__ */ jsxs(DialogContent, { children: [
        /* @__PURE__ */ jsxs(DialogContentText, { children: [
          "This will create a new ",
          viewType === "incidents" ? "incident" : "change request",
          " linked to the '",
          entity.metadata.name,
          "' component."
        ] }),
        /* @__PURE__ */ jsx(
          TextField,
          {
            autoFocus: true,
            margin: "dense",
            label: "Short Description",
            type: "text",
            fullWidth: true,
            value: newItemDescription,
            onChange: (e) => setNewItemDescription(e.target.value)
          }
        ),
        /* @__PURE__ */ jsxs(FormControl, { fullWidth: true, margin: "dense", children: [
          /* @__PURE__ */ jsx(InputLabel, { children: "Priority" }),
          /* @__PURE__ */ jsxs(Select, { value: newItemPriority, onChange: (e) => setNewItemPriority(e.target.value), label: "Priority", children: [
            /* @__PURE__ */ jsx(MenuItem, { value: "1", children: "1 - Critical" }),
            /* @__PURE__ */ jsx(MenuItem, { value: "2", children: "2 - High" }),
            /* @__PURE__ */ jsx(MenuItem, { value: "3", children: "3 - Moderate" }),
            /* @__PURE__ */ jsx(MenuItem, { value: "4", children: "4 - Low" })
          ] })
        ] }),
        viewType === "changes" && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs(FormControl, { fullWidth: true, margin: "dense", children: [
            /* @__PURE__ */ jsx(InputLabel, { children: "Risk" }),
            /* @__PURE__ */ jsxs(Select, { value: newChangeRisk, onChange: (e) => setNewChangeRisk(e.target.value), label: "Risk", children: [
              /* @__PURE__ */ jsx(MenuItem, { value: "1", children: "High" }),
              /* @__PURE__ */ jsx(MenuItem, { value: "2", children: "Medium" }),
              /* @__PURE__ */ jsx(MenuItem, { value: "3", children: "Low" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            TextField,
            {
              margin: "dense",
              label: "Start Date",
              type: "datetime-local",
              fullWidth: true,
              value: newChangeStartDate,
              onChange: (e) => setNewChangeStartDate(e.target.value),
              InputLabelProps: { shrink: true }
            }
          ),
          /* @__PURE__ */ jsx(
            TextField,
            {
              margin: "dense",
              label: "End Date",
              type: "datetime-local",
              fullWidth: true,
              value: newChangeEndDate,
              onChange: (e) => setNewChangeEndDate(e.target.value),
              InputLabelProps: { shrink: true }
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs(DialogActions, { children: [
        /* @__PURE__ */ jsx(Button, { onClick: () => setDialogOpen(null), children: "Cancel" }),
        /* @__PURE__ */ jsx(Button, { onClick: handleCreateItem, color: "primary", children: "Create" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Dialog, { open: dialogOpen === "update", onClose: () => setDialogOpen(null), children: [
      /* @__PURE__ */ jsxs(DialogTitle, { children: [
        "Update ",
        viewType === "incidents" ? "Incident" : "Change"
      ] }),
      /* @__PURE__ */ jsx(DialogContent, { children: /* @__PURE__ */ jsx(
        TextField,
        {
          autoFocus: true,
          margin: "dense",
          label: "Short Description",
          type: "text",
          fullWidth: true,
          value: newItemDescription,
          onChange: (e) => setNewItemDescription(e.target.value)
        }
      ) }),
      /* @__PURE__ */ jsxs(DialogActions, { children: [
        /* @__PURE__ */ jsx(Button, { onClick: () => setDialogOpen(null), children: "Cancel" }),
        /* @__PURE__ */ jsx(Button, { onClick: handleUpdateItem, color: "primary", children: "Update" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Dialog, { open: dialogOpen === "resolve", onClose: () => setDialogOpen(null), children: [
      /* @__PURE__ */ jsx(DialogTitle, { children: viewType === "incidents" ? "Resolve Incident" : "Close Change" }),
      /* @__PURE__ */ jsx(DialogContent, { children: /* @__PURE__ */ jsx(
        TextField,
        {
          autoFocus: true,
          margin: "dense",
          label: viewType === "incidents" ? "Resolution Notes" : "Close Notes",
          type: "text",
          fullWidth: true,
          value: actionNotes,
          onChange: (e) => setActionNotes(e.target.value)
        }
      ) }),
      /* @__PURE__ */ jsxs(DialogActions, { children: [
        /* @__PURE__ */ jsx(Button, { onClick: () => setDialogOpen(null), children: "Cancel" }),
        /* @__PURE__ */ jsx(Button, { onClick: handleResolveItem, color: "primary", children: viewType === "incidents" ? "Resolve" : "Close" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Dialog, { open: dialogOpen === "close", onClose: () => setDialogOpen(null), children: [
      /* @__PURE__ */ jsx(DialogTitle, { children: viewType === "incidents" ? "Close Incident" : "Cancel Change" }),
      /* @__PURE__ */ jsx(DialogContent, { children: /* @__PURE__ */ jsx(
        TextField,
        {
          autoFocus: true,
          margin: "dense",
          label: viewType === "incidents" ? "Close Notes" : "Cancel Notes",
          type: "text",
          fullWidth: true,
          value: actionNotes,
          onChange: (e) => setActionNotes(e.target.value)
        }
      ) }),
      /* @__PURE__ */ jsxs(DialogActions, { children: [
        /* @__PURE__ */ jsx(Button, { onClick: () => setDialogOpen(null), children: "Cancel" }),
        /* @__PURE__ */ jsx(Button, { onClick: handleCloseItem, color: "primary", children: viewType === "incidents" ? "Close" : "Cancel" })
      ] })
    ] })
  ] });
};

export { ServiceNowEntityWidget };
//# sourceMappingURL=ServiceNowEntityWidget.esm.js.map
