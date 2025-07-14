import { useState } from 'react';
import {
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@material-ui/core';
import {
  Content,
  Header,
  Page,
  InfoCard,
} from '@backstage/core-components';
import { ServiceNowStandaloneWidget } from './ServiceNowStandaloneWidget';

export const ServiceNowPage = () => {
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('active=true');

  return (
    <Page themeId="tool">
      <Header title="ServiceNow Incident Dashboard" />
      <Content>
        <Grid container spacing={3} direction="column">
          <Grid item>
            <InfoCard title="Filters">
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Search Description"
                    variant="outlined"
                    onChange={e => setDescriptionFilter(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>State</InputLabel>
                    <Select
                      value={stateFilter}
                      onChange={e => setStateFilter(e.target.value as string)}
                      label="State"
                    >
                      <MenuItem value="active=true">Active</MenuItem>
                      <MenuItem value="state=6">Resolved</MenuItem>
                      <MenuItem value="state=7">Closed</MenuItem>
                      <MenuItem value="">All</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </InfoCard>
          </Grid>

          <Grid item>
            <ServiceNowStandaloneWidget
              stateFilter={stateFilter}
              descriptionFilter={descriptionFilter}
            />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};