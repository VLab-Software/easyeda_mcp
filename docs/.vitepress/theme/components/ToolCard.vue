<template>
  <div class="tool-card" :class="`tool-card--${type}`">
    <div class="tool-card__header">
      <code class="tool-card__name">{{ name }}</code>
      <span class="tool-card__badge" :class="`tool-card__badge--${type}`">
        {{ type === 'mutating' ? 'confirmed action' : type === 'navigation' ? 'navigation' : 'read-only' }}
      </span>
    </div>
    <p v-if="description" class="tool-card__desc">{{ description }}</p>
    <div v-if="$slots.default" class="tool-card__body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  name: string
  description?: string
  type?: 'read' | 'navigation' | 'export' | 'mutating'
}>()
</script>

<style scoped>
.tool-card {
  border: 1px solid var(--easy-card-border);
  border-radius: 16px;
  background: var(--easy-card-bg);
  padding: 16px 18px;
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}

.tool-card:hover {
  border-color: var(--vp-c-brand-soft);
  box-shadow: var(--easy-card-shadow);
}

.tool-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.tool-card__name {
  font-family: var(--vp-font-family-mono);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

.tool-card__badge {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.tool-card__badge--read {
  background: rgba(29, 158, 117, 0.1);
  color: #0f6e56;
  border: 1px solid rgba(29, 158, 117, 0.2);
}

.dark .tool-card__badge--read {
  background: rgba(29, 158, 117, 0.14);
  color: #5dcaa5;
}

.tool-card__badge--navigation {
  background: rgba(45, 140, 255, 0.1);
  color: var(--vp-c-brand-2);
  border: 1px solid rgba(45, 140, 255, 0.2);
}

.tool-card__badge--export {
  background: rgba(186, 117, 23, 0.1);
  color: #854f0b;
  border: 1px solid rgba(186, 117, 23, 0.2);
}

.dark .tool-card__badge--export {
  background: rgba(239, 159, 39, 0.12);
  color: #fac775;
}

.tool-card__badge--mutating {
  background: rgba(226, 75, 74, 0.1);
  color: #a32d2d;
  border: 1px solid rgba(226, 75, 74, 0.2);
}

.dark .tool-card__badge--mutating {
  background: rgba(226, 75, 74, 0.14);
  color: #f09595;
}

.tool-card__desc {
  font-size: 0.92rem;
  color: var(--vp-c-text-2);
  line-height: 1.55;
  margin: 0;
}

.tool-card__body {
  margin-top: 10px;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
}
</style>
