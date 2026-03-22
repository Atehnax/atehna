declare module 'plotly.js-basic-dist-min' {
  import type { PlotlyHTMLElement } from 'plotly.js';

  const Plotly: {
    newPlot: PlotlyHTMLElement['newPlot'];
    react: PlotlyHTMLElement['react'];
    purge: PlotlyHTMLElement['purge'];
    resize: PlotlyHTMLElement['resize'];
  } & Record<string, unknown>;

  export default Plotly;
}
