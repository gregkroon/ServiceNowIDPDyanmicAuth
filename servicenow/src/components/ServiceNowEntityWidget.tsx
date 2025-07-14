import React, { useState } from 'react';
import { useDebounce } from 'react-use';
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
import { useApi, discoveryApiRef, configApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useAsync } from 'react-use';
import { Alert } from '@material-ui/lab';
import {
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Menu,
  ButtonGroup,
  Chip,
} from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';

const SERVICENOW_CI_SYSID_ANNOTATION = 'servicenow.com/ci-sysid';

export type Incident = {
  sys_id: string;
  number: string;
  short_description: string;
  state: string;
  priority: string;
  opened_at: string;
};

export type Change = {
  sys_id: string;
  number: string;
  short_description: string;
  state: string;
  priority: string;
  risk: string;
  start_date: string;
  end_date: string;
};

type ViewType = 'incidents' | 'changes';

type AuthState = {
  username: string;
  password: string;
  isAuthenticated: boolean;
  authError: string | null;
  lastActivity: number;
};

const PriorityStatus = ({ priority }: { priority: string }) => {
  switch (priority) {
    case '1': return <StatusError>1 - Critical</StatusError>;
    case '2': return <StatusWarning>2 - High</StatusWarning>;
    case '3': return <StatusOK>3 - Moderate</StatusOK>;
    default: return <StatusAborted>{priority} - Low</StatusAborted>;
  }
};

const RiskStatus = ({ risk }: { risk: string }) => {
  switch (risk) {
    case '1': return <StatusError>High</StatusError>;
    case '2': return <StatusWarning>Medium</StatusWarning>;
    case '3': return <StatusOK>Low</StatusOK>;
    default: return <StatusAborted>Unknown</StatusAborted>;
  }
};

const ChangeStateChip = ({ state }: { state: string }) => {
  const stateMap: { [key: string]: { label: string; color: 'primary' | 'secondary' | 'default' } } = {
    '-5': { label: 'New', color: 'primary' },
    '-4': { label: 'Assess', color: 'secondary' },
    '-3': { label: 'Authorize', color: 'secondary' },
    '-2': { label: 'Scheduled', color: 'primary' },
    '-1': { label: 'Implement', color: 'secondary' },
    '0': { label: 'Review', color: 'secondary' },
    '3': { label: 'Closed', color: 'default' },
    '4': { label: 'Cancelled', color: 'default' },
  };
  const stateInfo = stateMap[state] || { label: state, color: 'default' as const };
  return <Chip label={stateInfo.label} color={stateInfo.color} size="small" />;
};

export const ServiceNowEntityWidget = () => {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const configApi = useApi(configApiRef);

  const [viewType, setViewType] = useState<ViewType>('incidents');
  const [stateFilter, setStateFilter] = useState('active=true');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [debouncedDescriptionFilter, setDebouncedDescriptionFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [refreshCount, setRefreshCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState<'create' | 'update' | 'resolve' | 'close' | 'login' | null>(null);
  const [selectedItem, setSelectedItem] = useState<Incident | Change | null>(null);
  const [pendingMenuItem, setPendingMenuItem] = useState<Incident | Change | null>(null);
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemPriority, setNewItemPriority] = useState('3');
  const [newChangeRisk, setNewChangeRisk] = useState('3');
  const [newChangeStartDate, setNewChangeStartDate] = useState('');
  const [newChangeEndDate, setNewChangeEndDate] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [actionError, setActionError] = useState<Error | null>(null);
  
  // Authentication state
  const [authState, setAuthState] = useState<AuthState>({
    username: '',
    password: '',
    isAuthenticated: false,
    authError: null,
    lastActivity: Date.now(),
  });
  const [tempUsername, setTempUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  // Session management
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  useDebounce(() => {
    setDebouncedDescriptionFilter(descriptionInput);
  }, 500, [descriptionInput]);

  // Simple session timeout
  React.useEffect(() => {
    if (authState.isAuthenticated) {
      const timeout = setTimeout(() => {
        setAuthState(prev => ({ 
          ...prev, 
          isAuthenticated: false,
          authError: 'Session expired. Please login again.'
        }));
      }, SESSION_TIMEOUT);
      
      return () => clearTimeout(timeout);
    }
  }, [authState.isAuthenticated]);

  const ciSysId = entity.metadata.annotations?.[SERVICENOW_CI_SYSID_ANNOTATION] ?? '';

  // Get ServiceNow instance URL from proxy configuration
  const getServiceNowInstanceUrl = () => {
    try {
      // Try to get from Backstage config
      const proxyConfig = configApi.getOptionalConfig('proxy.endpoints./servicenow');
      const target = proxyConfig?.getString('target');
      if (target) {
        return target.replace(/\/$/, ''); // Remove trailing slash
      }
    } catch {
      // No fallback - return null if config can't be read
    }
    return null; // Return null if no config found
  };

  // Create Basic Auth header
  const createAuthHeader = () => {
    if (!authState.username || !authState.password) {
      throw new Error('ServiceNow credentials are required');
    }
    const credentials = `${authState.username}:${authState.password}`;
    const encodedCredentials = btoa(credentials);
    return `Basic ${encodedCredentials}`;
  };

  // Check if API call failed due to authentication
  const isAuthError = (response: Response) => {
    return response.status === 401 || response.status === 403;
  };

  const handleAuthError = () => {
    setAuthState(prev => ({
      username: '',
      password: '',
      isAuthenticated: false,
      authError: 'Authentication failed. Please check your credentials.',
      lastActivity: Date.now(),
    }));
    setDialogOpen('login');
  };

  const handleLogin = () => {
    console.log('handleLogin called with:', { username: tempUsername, hasPassword: !!tempPassword });
    setAuthState({
      username: tempUsername,
      password: tempPassword,
      isAuthenticated: true,
      authError: null,
    });
    setTempUsername('');
    setTempPassword('');
    setDialogOpen(null);
    setRefreshCount(c => c + 1); // Trigger data refresh
  };

  const handleLogout = () => {
    setAuthState({
      username: '',
      password: '',
      isAuthenticated: false,
      authError: null,
    });
  };

  const { value, loading, error } = useAsync(
    async (): Promise<{ items: (Incident | Change)[]; totalCount: number } | null> => {
      if (!ciSysId) return null;
      if (!authState.isAuthenticated) return null;
      
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      
      const table = viewType === 'incidents' ? 'incident' : 'change_request';
      let queryParts = [`cmdb_ci=${ciSysId}`];
      if (stateFilter) queryParts.push(stateFilter);
      if (debouncedDescriptionFilter) queryParts.push(`short_descriptionLIKE${debouncedDescriptionFilter}`);
      const query = queryParts.join('^');
      
      const fields = viewType === 'incidents' 
        ? 'sys_id,number,short_description,state,priority,opened_at'
        : 'sys_id,number,short_description,state,priority,risk,start_date,end_date';
      
      const offset = page * pageSize;
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}?sysparm_query=${query}&sysparm_fields=${fields}&sysparm_limit=${pageSize}&sysparm_offset=${offset}`;
      
      const response = await fetch(url, {
        headers: { 
          'Authorization': createAuthHeader(),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      if (isAuthError(response)) {
        handleAuthError();
        return null;
      }
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText} - ${text}`);
      }
      
      const totalCount = parseInt(response.headers.get('X-Total-Count') || '0', 10);
      const data = (await response.json()) as { result?: (Incident | Change)[] };
      return { items: data.result ?? [], totalCount };
    },
    [discoveryApi, ciSysId, authState.isAuthenticated, authState.username, authState.password, stateFilter, debouncedDescriptionFilter, page, pageSize, refreshCount, viewType],
  );

  const handleAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
      setRefreshCount(c => c + 1);
      return true;
    } catch (e: any) {
      // Generic error message for user actions (not auth-related)
      setActionError(new Error('Operation failed. Please try again.'));
      return false;
    }
  };

  const sendApiRequest = async (url: string, options: RequestInit) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': createAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    if (isAuthError(response)) {
      handleAuthError();
      throw new Error('Authentication failed');
    }
    
    if (!response.ok) {
      // Keep detailed errors for auth issues (401/403) but generic for others
      if (response.status === 401 || response.status === 403) {
        const text = await response.text();
        throw new Error(`Authentication error: ${response.status} - ${text}`);
      }
      // Generic error for non-auth issues
      throw new Error('Request failed. Please try again.');
    }
  };

  const handleCreateItem = async () => {
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      const table = viewType === 'incidents' ? 'incident' : 'change_request';
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}`;
      
      const baseData = {
        short_description: newItemDescription,
        cmdb_ci: ciSysId,
        priority: newItemPriority,
      };
      
      const requestData = viewType === 'incidents' 
        ? baseData 
        : {
            ...baseData,
            risk: newChangeRisk,
            start_date: newChangeStartDate,
            end_date: newChangeEndDate,
          };
      
      await sendApiRequest(url, {
        method: 'POST',
        body: JSON.stringify(requestData),
      });
    });
    
    if (success) {
      setDialogOpen(null);
      setNewItemDescription('');
      setNewItemPriority('3');
      setNewChangeRisk('3');
      setNewChangeStartDate('');
      setNewChangeEndDate('');
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      const table = viewType === 'incidents' ? 'incident' : 'change_request';
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}/${selectedItem.sys_id}`;
      await sendApiRequest(url, {
        method: 'PATCH',
        body: JSON.stringify({ short_description: newItemDescription }),
      });
    });
    if (success) setDialogOpen(null);
  };

  const handleResolveItem = async () => {
    if (!selectedItem) return;
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      const table = viewType === 'incidents' ? 'incident' : 'change_request';
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}/${selectedItem.sys_id}`;
      const resolveState = viewType === 'incidents' ? '6' : '3'; // Resolved for incidents, Closed for changes
      await sendApiRequest(url, {
        method: 'PATCH',
        body: JSON.stringify({ state: resolveState, close_notes: actionNotes }),
      });
    });
    if (success) setDialogOpen(null);
  };

  const handleCloseItem = async () => {
    if (!selectedItem) return;
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      const table = viewType === 'incidents' ? 'incident' : 'change_request';
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}/${selectedItem.sys_id}`;
      const closeState = viewType === 'incidents' ? '7' : '4'; // Closed for incidents, Cancelled for changes
      await sendApiRequest(url, {
        method: 'PATCH',
        body: JSON.stringify({ state: closeState, close_notes: actionNotes }),
      });
    });
    if (success) setDialogOpen(null);
  };

  const openDialog = (type: 'update' | 'resolve' | 'close', item: Incident | Change) => {
    setSelectedItem(item);
    setNewItemDescription(item.short_description || '');
    setActionNotes('');
    setDialogOpen(type);
    setMenuPosition(null);
    setPendingMenuItem(null);
  };

  const getStateFilterOptions = () => {
    if (viewType === 'incidents') {
      return [
        { value: 'active=true', label: 'Active' },
        { value: 'state=6', label: 'Resolved' },
        { value: 'state=7', label: 'Closed' },
        { value: '', label: 'All' },
      ];
    } else {
      return [
        { value: 'active=true', label: 'Active' },
        { value: 'state=3', label: 'Closed' },
        { value: 'state=4', label: 'Cancelled' },
        { value: '', label: 'All' },
      ];
    }
  };

  const getColumns = (): TableColumn<Incident | Change>[] => {
    const baseColumns = [
      { 
        title: 'Number', 
        field: 'number', 
        width: '10%', 
        render: (rowData: Incident | Change) => {
          const instanceUrl = getServiceNowInstanceUrl();
          
          // Only show link if we have a valid instance URL from config
          if (instanceUrl) {
            return (
              <a 
                href={`${instanceUrl}/nav_to.do?uri=${viewType === 'incidents' ? 'incident' : 'change_request'}.do?sys_id=${rowData.sys_id}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                {rowData.number}
              </a>
            );
          }
          
          // If no URL configured, just show the number as text
          return <span>{rowData.number}</span>;
        }
      },
      { title: 'Description', field: 'short_description' },
      { 
        title: 'State', 
        field: 'state', 
        width: '10%',
        render: (rowData: Incident | Change) => 
          viewType === 'changes' ? <ChangeStateChip state={rowData.state} /> : rowData.state
      },
      { 
        title: 'Priority', 
        field: 'priority', 
        width: '15%', 
        render: (rowData: Incident | Change) => <PriorityStatus priority={rowData.priority} /> 
      },
    ];

    if (viewType === 'incidents') {
      baseColumns.push({ title: 'Opened At', field: 'opened_at', type: 'datetime' });
    } else {
      baseColumns.push(
        { 
          title: 'Risk', 
          field: 'risk', 
          width: '10%', 
          render: (rowData: Change) => <RiskStatus risk={rowData.risk} /> 
        },
        { title: 'Start Date', field: 'start_date', type: 'datetime' },
        { title: 'End Date', field: 'end_date', type: 'datetime' }
      );
    }

    baseColumns.push({
      title: 'Actions',
      field: 'actions',
      width: '5%',
      render: (rowData: Incident | Change) => (
        <IconButton
          aria-label="more"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuPosition({ top: e.clientY, left: e.clientX });
            setPendingMenuItem(rowData);
          }}
        >
          <MoreVertIcon />
        </IconButton>
      ),
    });

    return baseColumns;
  };

  const handleViewTypeChange = (newViewType: ViewType) => {
    setViewType(newViewType);
    setPage(0);
    setStateFilter('active=true');
    setDescriptionInput('');
    setDebouncedDescriptionFilter('');
  };

  // Show message if no CI System ID
  if (!ciSysId) {
    return (
      <InfoCard title="ServiceNow Integration">
        <Alert severity="warning">
          No ServiceNow CI System ID found. Please add the annotation 'servicenow.com/ci-sysid' to your entity.
        </Alert>
      </InfoCard>
    );
  }

  // Show login prompt if not authenticated
  if (!authState.isAuthenticated) {
    console.log('Rendering login prompt, dialogOpen:', dialogOpen);
    return (
      <InfoCard title="ServiceNow Integration">
        <Grid container spacing={2} direction="column" alignItems="center">
          <Grid item>
            <Alert severity="info">
              Please login to ServiceNow to view incidents and changes.
            </Alert>
          </Grid>
          {authState.authError && (
            <Grid item>
              <Alert severity="error">{authState.authError}</Alert>
            </Grid>
          )}
          <Grid item>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => {
                console.log('Login button clicked, current dialogOpen:', dialogOpen);
                setDialogOpen('login');
                console.log('Set dialogOpen to login');
              }}
            >
              Login to ServiceNow
            </Button>
          </Grid>
        </Grid>

        {/* Login Dialog - moved here to ensure it renders */}
        <Dialog 
          open={dialogOpen === 'login'} 
          onClose={() => {
            console.log('Dialog close triggered');
            setDialogOpen(null);
            setTempUsername('');
            setTempPassword('');
            setAuthState(prev => ({ ...prev, authError: null }));
          }} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>ServiceNow Login</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Please enter your ServiceNow credentials to access incidents and changes.
            </DialogContentText>
            {authState.authError && (
              <Alert severity="error" style={{ marginBottom: '16px' }}>
                {authState.authError}
              </Alert>
            )}
            <TextField 
              autoFocus 
              margin="dense" 
              label="Username" 
              type="text" 
              fullWidth 
              value={tempUsername} 
              onChange={e => setTempUsername(e.target.value)}
              onKeyPress={e => {
                if (e.key === 'Enter' && tempUsername && tempPassword) {
                  handleLogin();
                }
              }}
            />
            <TextField 
              margin="dense" 
              label="Password" 
              type="password" 
              fullWidth 
              value={tempPassword} 
              onChange={e => setTempPassword(e.target.value)}
              onKeyPress={e => {
                if (e.key === 'Enter' && tempUsername && tempPassword) {
                  handleLogin();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              console.log('Cancel button clicked');
              setDialogOpen(null);
              setTempUsername('');
              setTempPassword('');
              setAuthState(prev => ({ ...prev, authError: null }));
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleLogin} 
              color="primary" 
              variant="contained"
              disabled={!tempUsername || !tempPassword}
            >
              Login
            </Button>
          </DialogActions>
        </Dialog>
      </InfoCard>
    );
  }

  return (
    <InfoCard title="ServiceNow">
      <Grid container spacing={2} direction="column">
        <Grid item>
          <Grid container spacing={2} alignItems="center" justifyContent="space-between">
            <Grid item>
              <ButtonGroup variant="contained" color="primary">
                <Button 
                  variant={viewType === 'incidents' ? 'contained' : 'outlined'}
                  onClick={() => handleViewTypeChange('incidents')}
                >
                  Incidents
                </Button>
                <Button 
                  variant={viewType === 'changes' ? 'contained' : 'outlined'}
                  onClick={() => handleViewTypeChange('changes')}
                >
                  Changes
                </Button>
              </ButtonGroup>
            </Grid>
            <Grid item>
              <Grid container spacing={1}>
                <Grid item>
                  <Button variant="contained" color="primary" onClick={() => setDialogOpen('create')}>
                    Create {viewType === 'incidents' ? 'Incident' : 'Change'}
                  </Button>
                </Grid>
                <Grid item>
                  <Button variant="outlined" onClick={handleLogout}>
                    Logout
                  </Button>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
        
        <Grid item>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                label="Search Description" 
                variant="outlined" 
                value={descriptionInput}
                onChange={e => setDescriptionInput(e.target.value)} 
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>State</InputLabel>
                <Select value={stateFilter} onChange={e => setStateFilter(e.target.value as string)} label="State">
                  {getStateFilterOptions().map(option => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Grid>

        <Grid item>
          {loading && <Progress />}
          {error && <Alert severity="error">{error.message}</Alert>}
          {actionError && <Alert severity="error">{actionError.message}</Alert>}
          {!loading && !error && value && (
            <Table
              columns={getColumns()}
              data={value.items}
              options={{ search: false, paging: true, pageSize: 5, padding: 'dense' }}
              page={page}
              totalCount={value.totalCount}
              onPageChange={setPage}
              onRowsPerPageChange={setPageSize}
            />
          )}
        </Grid>
      </Grid>

      <Menu
        open={Boolean(menuPosition)}
        onClose={() => {
          setMenuPosition(null);
          setPendingMenuItem(null);
        }}
        anchorReference="anchorPosition"
        anchorPosition={menuPosition ?? undefined}
        keepMounted
      >
        <MenuItem onClick={() => pendingMenuItem && openDialog('update', pendingMenuItem)}>
          Update
        </MenuItem>
        <MenuItem onClick={() => pendingMenuItem && openDialog('resolve', pendingMenuItem)}>
          {viewType === 'incidents' ? 'Resolve' : 'Close'}
        </MenuItem>
        <MenuItem onClick={() => pendingMenuItem && openDialog('close', pendingMenuItem)}>
          {viewType === 'incidents' ? 'Close' : 'Cancel'}
        </MenuItem>
      </Menu>

      {/* Login Dialog is now moved to the unauthenticated section above */}

      <Dialog open={dialogOpen === 'create'} onClose={() => setDialogOpen(null)} maxWidth="md" fullWidth>
        <DialogTitle>Create New {viewType === 'incidents' ? 'Incident' : 'Change'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will create a new {viewType === 'incidents' ? 'incident' : 'change request'} linked to the '{entity.metadata.name}' component.
          </DialogContentText>
          <TextField 
            autoFocus 
            margin="dense" 
            label="Short Description" 
            type="text" 
            fullWidth 
            value={newItemDescription} 
            onChange={e => setNewItemDescription(e.target.value)} 
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Priority</InputLabel>
            <Select value={newItemPriority} onChange={e => setNewItemPriority(e.target.value as string)} label="Priority">
              <MenuItem value="1">1 - Critical</MenuItem>
              <MenuItem value="2">2 - High</MenuItem>
              <MenuItem value="3">3 - Moderate</MenuItem>
              <MenuItem value="4">4 - Low</MenuItem>
            </Select>
          </FormControl>
          
          {viewType === 'changes' && (
            <>
              <FormControl fullWidth margin="dense">
                <InputLabel>Risk</InputLabel>
                <Select value={newChangeRisk} onChange={e => setNewChangeRisk(e.target.value as string)} label="Risk">
                  <MenuItem value="1">High</MenuItem>
                  <MenuItem value="2">Medium</MenuItem>
                  <MenuItem value="3">Low</MenuItem>
                </Select>
              </FormControl>
              <TextField
                margin="dense"
                label="Start Date"
                type="datetime-local"
                fullWidth
                value={newChangeStartDate}
                onChange={e => setNewChangeStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                margin="dense"
                label="End Date"
                type="datetime-local"
                fullWidth
                value={newChangeEndDate}
                onChange={e => setNewChangeEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>
          <Button onClick={handleCreateItem} color="primary">Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen === 'update'} onClose={() => setDialogOpen(null)}>
        <DialogTitle>Update {viewType === 'incidents' ? 'Incident' : 'Change'}</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus 
            margin="dense" 
            label="Short Description" 
            type="text" 
            fullWidth 
            value={newItemDescription} 
            onChange={e => setNewItemDescription(e.target.value)} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>
          <Button onClick={handleUpdateItem} color="primary">Update</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen === 'resolve'} onClose={() => setDialogOpen(null)}>
        <DialogTitle>{viewType === 'incidents' ? 'Resolve Incident' : 'Close Change'}</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus 
            margin="dense" 
            label={viewType === 'incidents' ? 'Resolution Notes' : 'Close Notes'} 
            type="text" 
            fullWidth 
            value={actionNotes} 
            onChange={e => setActionNotes(e.target.value)} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>
          <Button onClick={handleResolveItem} color="primary">
            {viewType === 'incidents' ? 'Resolve' : 'Close'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen === 'close'} onClose={() => setDialogOpen(null)}>
        <DialogTitle>{viewType === 'incidents' ? 'Close Incident' : 'Cancel Change'}</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus 
            margin="dense" 
            label={viewType === 'incidents' ? 'Close Notes' : 'Cancel Notes'} 
            type="text" 
            fullWidth 
            value={actionNotes} 
            onChange={e => setActionNotes(e.target.value)} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>
          <Button onClick={handleCloseItem} color="primary">
            {viewType === 'incidents' ? 'Close' : 'Cancel'}
          </Button>
        </DialogActions>
      </Dialog>
    </InfoCard>
  );
};
