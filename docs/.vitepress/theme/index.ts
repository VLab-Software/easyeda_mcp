import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import ToolCard from "./components/ToolCard.vue";
import ToolGroup from "./components/ToolGroup.vue";
import StepList from "./components/StepList.vue";
import HomeVideoBackground from "./components/HomeVideoBackground.vue";
import "./custom.css";

const theme: Theme = {
  ...DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "home-hero-before": () => h(HomeVideoBackground)
    }),
  enhanceApp({ app }) {
    app.component("ToolCard", ToolCard);
    app.component("ToolGroup", ToolGroup);
    app.component("StepList", StepList);
  }
};

export default theme;
