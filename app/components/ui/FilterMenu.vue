<script setup lang="ts" generic="T extends string">
import {
    PopoverContent,
    PopoverPortal,
    PopoverRoot,
    PopoverTrigger,
} from 'reka-ui'

type Option = { label: string; value: T }

const props = defineProps<{
    label: string
    items: readonly (T | Option)[]
}>()

const model = defineModel<T[]>({ default: () => [] })

const options = computed<Option[]>(() =>
    props.items.map((item) =>
        typeof item === 'object' ? item : { label: String(item), value: item },
    ),
)

function toggle(value: T) {
    model.value =
        model.value.includes(value) ?
            model.value.filter((v) => v !== value)
        :   [...model.value, value]
}
</script>

<template>
    <PopoverRoot>
        <PopoverTrigger
            class="filter-trigger"
            :class="{ active: model.length > 0 }"
        >
            <span>{{ label }}</span>
            <span
                v-if="model.length"
                class="filter-count"
            >
                {{ model.length }}
            </span>
            <Icon
                name="tabler:chevron-down"
                :size="15"
            />
        </PopoverTrigger>
        <PopoverPortal>
            <PopoverContent
                class="select-content filter-content"
                align="start"
                :side-offset="6"
            >
                <div class="select-viewport">
                    <button
                        v-for="option in options"
                        :key="String(option.value)"
                        type="button"
                        class="select-item filter-item"
                        :data-state="
                            model.includes(option.value) ? 'checked' : undefined
                        "
                        @click="toggle(option.value)"
                    >
                        <span>{{ option.label }}</span>
                        <Icon
                            v-if="model.includes(option.value)"
                            name="tabler:check"
                            :size="15"
                        />
                    </button>
                </div>
            </PopoverContent>
        </PopoverPortal>
    </PopoverRoot>
</template>
