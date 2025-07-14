import { jsxs, jsx } from 'react/jsx-runtime';
import { useState } from 'react';
import { Grid, TextField, FormControl, InputLabel, Select, MenuItem } from '@material-ui/core';
import { Page, Header, Content, InfoCard } from '@backstage/core-components';
import { ServiceNowStandaloneWidget } from './ServiceNowStandaloneWidget.esm.js';

const ServiceNowPage = () => {
  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("active=true");
  return /* @__PURE__ */ jsxs(Page, { themeId: "tool", children: [
    /* @__PURE__ */ jsx(Header, { title: "ServiceNow Incident Dashboard" }),
    /* @__PURE__ */ jsx(Content, { children: /* @__PURE__ */ jsxs(Grid, { container: true, spacing: 3, direction: "column", children: [
      /* @__PURE__ */ jsx(Grid, { item: true, children: /* @__PURE__ */ jsx(InfoCard, { title: "Filters", children: /* @__PURE__ */ jsxs(Grid, { container: true, spacing: 2, children: [
        /* @__PURE__ */ jsx(Grid, { item: true, xs: 12, md: 4, children: /* @__PURE__ */ jsx(
          TextField,
          {
            fullWidth: true,
            label: "Search Description",
            variant: "outlined",
            onChange: (e) => setDescriptionFilter(e.target.value)
          }
        ) }),
        /* @__PURE__ */ jsx(Grid, { item: true, xs: 12, md: 4, children: /* @__PURE__ */ jsxs(FormControl, { fullWidth: true, variant: "outlined", children: [
          /* @__PURE__ */ jsx(InputLabel, { children: "State" }),
          /* @__PURE__ */ jsxs(
            Select,
            {
              value: stateFilter,
              onChange: (e) => setStateFilter(e.target.value),
              label: "State",
              children: [
                /* @__PURE__ */ jsx(MenuItem, { value: "active=true", children: "Active" }),
                /* @__PURE__ */ jsx(MenuItem, { value: "state=6", children: "Resolved" }),
                /* @__PURE__ */ jsx(MenuItem, { value: "state=7", children: "Closed" }),
                /* @__PURE__ */ jsx(MenuItem, { value: "", children: "All" })
              ]
            }
          )
        ] }) })
      ] }) }) }),
      /* @__PURE__ */ jsx(Grid, { item: true, children: /* @__PURE__ */ jsx(
        ServiceNowStandaloneWidget,
        {
          stateFilter,
          descriptionFilter
        }
      ) })
    ] }) })
  ] });
};

export { ServiceNowPage };
//# sourceMappingURL=ServiceNowPage.esm.js.map
