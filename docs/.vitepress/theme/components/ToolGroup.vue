<template>
  <div class="tool-group">
    <div v-if="label" class="tool-group__label">{{ label }}</div>
    <div class="tool-group__grid">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label?: string
}>()
</script>

<style scoped>
.tool-group {
  margin: 1.4rem 0 2rem;
}

.tool-group__label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--easy-section-kicker);
  margin-bottom: 10px;
}

.tool-group__grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}
</style>
