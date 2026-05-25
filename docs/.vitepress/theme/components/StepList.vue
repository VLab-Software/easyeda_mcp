<template>
  <ol class="step-list">
    <li
      v-for="(step, i) in steps"
      :key="i"
      class="step-item"
    >
      <div class="step-number" aria-hidden="true">{{ i + 1 }}</div>
      <div class="step-content">
        <strong v-if="step.title" class="step-title">{{ step.title }}</strong>
        <span v-if="step.title && step.body" class="step-body"> — </span>
        <span class="step-body">{{ step.body ?? step }}</span>
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
defineProps<{
  steps: Array<string | { title: string; body: string }>
}>()
</script>

<style scoped>
.step-list {
  list-style: none;
  padding: 0;
  margin: 1.2rem 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.step-number {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 0.78rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.step-content {
  flex: 1;
  font-size: 0.96rem;
  color: var(--vp-c-text-1);
  line-height: 1.55;
  padding-top: 4px;
}

.step-title {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.step-body {
  color: var(--vp-c-text-2);
}
</style>
