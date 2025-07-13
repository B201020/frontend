import { html, LitElement, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators";
import { repeat } from "lit/directives/repeat";
import { styleMap } from "lit/directives/style-map";
import memoizeOne from "memoize-one";
import { mdiDrag, mdiClose } from "@mdi/js";
import { fireEvent } from "../../../../common/dom/fire_event";
import type { HaSwitch } from "../../../../components/ha-switch";
import "../../../../components/ha-form/ha-form";
import "../../../../components/ha-icon-picker";
import "../../../../components/ha-textfield";
import "../../../../components/ha-switch";
import "../../../../components/ha-card";
import "../../../../components/ha-icon";
import "../../../../components/ha-svg-icon";
import "../../../../components/ha-icon-button";
import "../../../../components/ha-color-picker";
import type {
  HaFormSchema,
  SchemaUnion,
} from "../../../../components/ha-form/types";
import type { HomeAssistant } from "../../../../types";
import type {
  LovelaceCardFeatureContext,
  SelectOptionsCardFeatureConfig,
} from "../../card-features/types";
import type { LovelaceCardFeatureEditor } from "../../types";

type SelectOptionsCardFeatureData = SelectOptionsCardFeatureConfig & {
  customize_options: boolean;
};

interface OptionConfig {
  icon?: string;
  name?: string;
  color?: string;
  disabled?: boolean;
}

interface OptionItem {
  value: string;
  config: OptionConfig;
  defaultName: string;
}

@customElement("hui-select-options-card-feature-editor")
export class HuiSelectOptionsCardFeatureEditor
  extends LitElement
  implements LovelaceCardFeatureEditor
{
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public context?: LovelaceCardFeatureContext;

  @state() private _config?: SelectOptionsCardFeatureConfig;

  @state() private _draggedIndex?: number;

  @state() private _dragOverIndex?: number;

  public setConfig(config: SelectOptionsCardFeatureConfig): void {
    this._config = config;
  }

  private _schema = memoizeOne(
    (customizeOptions: boolean, _style: string) =>
      [
        {
          name: "style",
          selector: {
            select: {
              options: [
                {
                  value: "dropdown",
                  label: "Dropdown",
                },
                {
                  value: "icons",
                  label: "Icon buttons",
                },
              ],
            },
          },
        },
        ...(customizeOptions
          ? ([
              {
                name: "customize_options",
                selector: {
                  boolean: {},
                },
              },
            ] as const)
          : ([
              {
                name: "customize_options",
                selector: {
                  boolean: {},
                },
              },
            ] as const)),
      ] as const satisfies readonly HaFormSchema[]
  );

  private _getOptionItems(): OptionItem[] {
    if (!this.hass || !this.context?.entity_id) return [];

    const stateObj = this.hass.states[this.context.entity_id];
    if (!stateObj?.attributes.options) return [];

    const availableOptions = stateObj.attributes.options as string[];
    const configuredOptions = this._config?.options || availableOptions;
    const optionConfig = this._config?.option_config || {};

    return configuredOptions.map((option) => ({
      value: option,
      config: optionConfig[option] || {},
      defaultName: this.hass!.formatEntityState(stateObj, option),
    }));
  }

  private _valueChanged(ev: CustomEvent): void {
    const { customize_options, ...config } = ev.detail
      .value as SelectOptionsCardFeatureData;

    const stateObj = this.context?.entity_id
      ? this.hass!.states[this.context?.entity_id]
      : undefined;

    if (customize_options && !config.options) {
      config.options = (stateObj?.attributes.options as string[]) || [];
    }
    if (!customize_options && config.options) {
      delete config.options;
      delete config.option_config;
    }

    fireEvent(this, "config-changed", { config: config });
  }

  private _updateOptionConfig(option: string, updates: Partial<OptionConfig>) {
    if (!this._config) return;

    const newConfig = { ...this._config };
    newConfig.option_config = { ...(newConfig.option_config || {}) };
    newConfig.option_config[option] = {
      ...(newConfig.option_config[option] || {}),
      ...updates,
    };

    // Clean up empty configs
    if (Object.keys(newConfig.option_config[option]).length === 0) {
      delete newConfig.option_config[option];
    }
    if (Object.keys(newConfig.option_config).length === 0) {
      delete newConfig.option_config;
    }

    fireEvent(this, "config-changed", { config: newConfig });
  }

  private _removeOption(option: string) {
    if (!this._config) return;

    const newConfig = { ...this._config };

    if (newConfig.options) {
      newConfig.options = newConfig.options.filter((o) => o !== option);
    }

    if (newConfig.option_config?.[option]) {
      delete newConfig.option_config[option];
      if (Object.keys(newConfig.option_config).length === 0) {
        delete newConfig.option_config;
      }
    }

    fireEvent(this, "config-changed", { config: newConfig });
  }

  private _addOption(option: string) {
    if (!this._config) return;

    const stateObj = this.context?.entity_id
      ? this.hass!.states[this.context.entity_id]
      : undefined;

    const currentOptions =
      this._config.options || (stateObj?.attributes.options as string[]) || [];
    const newOptions = [...currentOptions];

    if (!newOptions.includes(option)) {
      newOptions.push(option);
    }

    fireEvent(this, "config-changed", {
      config: { ...this._config, options: newOptions },
    });
  }

  private _reorderOptions(fromIndex: number, toIndex: number) {
    const config = this._config;
    if (!config || !config.options) {
      return;
    }
    const options = [...config.options];
    const [movedOption] = options.splice(fromIndex, 1);
    options.splice(toIndex, 0, movedOption);
    fireEvent(this, "config-changed", {
      config: { ...config, options },
    });
  }

  private _handleDragStart(ev: DragEvent) {
    const index = (ev.currentTarget as HTMLElement).dataset.index;
    if (index) {
      this._draggedIndex = Number(index);
      ev.dataTransfer!.effectAllowed = "move";
    }
  }

  private _handleDragEnd() {
    this._draggedIndex = undefined;
    this._dragOverIndex = undefined;
  }

  private _handleDragOver(ev: DragEvent) {
    ev.preventDefault();
    const index = (ev.currentTarget as HTMLElement).dataset.index;
    if (index) {
      this._dragOverIndex = Number(index);
    }
  }

  private _handleDrop(ev: DragEvent) {
    ev.preventDefault();
    const index = (ev.currentTarget as HTMLElement).dataset.index;
    if (index && this._draggedIndex !== undefined) {
      const toIndex = Number(index);
      if (this._draggedIndex !== toIndex) {
        this._reorderOptions(this._draggedIndex, toIndex);
      }
    }
    this._draggedIndex = undefined;
    this._dragOverIndex = undefined;
  }

  private _handleSwitchChange(ev: Event) {
    const target = ev.currentTarget as HaSwitch;
    const option = (target as HTMLElement).dataset.optionValue;
    if (option) {
      this._updateOptionConfig(option, { disabled: !target.checked });
    }
  }

  private _handleRemoveOptionClick(ev: Event) {
    const option = (ev.currentTarget as HTMLElement).dataset.optionValue;
    if (option) {
      this._removeOption(option);
    }
  }

  private _handleIconChange(ev: CustomEvent) {
    const option = (ev.currentTarget as HTMLElement).dataset.optionValue;
    if (option) {
      this._updateOptionConfig(option, { icon: ev.detail.value || undefined });
    }
  }

  private _handleNameChange(ev: Event) {
    const target = ev.target as any;
    const option = (ev.currentTarget as HTMLElement).dataset.optionValue;
    if (option) {
      this._updateOptionConfig(option, { name: target.value || undefined });
    }
  }

  private _handleColorChange(ev: CustomEvent) {
    const option = (ev.currentTarget as HTMLElement).dataset.optionValue;
    if (option) {
      this._updateOptionConfig(option, { color: ev.detail.value || undefined });
    }
  }

  private _handleAddOptionClick(ev: Event) {
    const option = (ev.currentTarget as HTMLElement).dataset.optionValue;
    if (option) {
      this._addOption(option);
    }
  }

  private _renderOptionEditor(item: OptionItem, index: number) {
    const { value, config, defaultName } = item;
    const displayName = config.name || defaultName;
    const isDisabled = config.disabled || false;

    return html`
      <ha-card
        class="option-card ${this._dragOverIndex === index ? "drag-over" : ""}"
        draggable="true"
        data-index=${index}
        @dragstart=${this._handleDragStart}
        @dragend=${this._handleDragEnd}
        @dragover=${this._handleDragOver}
        @drop=${this._handleDrop}
        style=${styleMap({
          opacity: isDisabled ? "0.5" : "1",
        })}
      >
        <div class="option-header">
          <ha-svg-icon class="drag-handle" .path=${mdiDrag}></ha-svg-icon>
          <div class="option-preview">
            ${config.icon
              ? html`<ha-icon
                  .icon=${config.icon}
                  style=${styleMap({ color: config.color || "" })}
                ></ha-icon>`
              : nothing}
            <span class="option-name">${displayName}</span>
          </div>
          <ha-switch
            .checked=${!isDisabled}
            data-option-value=${value}
            @change=${this._handleSwitchChange}
          ></ha-switch>
          <ha-icon-button
            .path=${mdiClose}
            data-option-value=${value}
            @click=${this._handleRemoveOptionClick}
            title="Remove option"
          ></ha-icon-button>
        </div>

        <div class="option-controls">
          <ha-icon-picker
            .hass=${this.hass}
            .value=${config.icon || ""}
            .label=${"Icon"}
            data-option-value=${value}
            @value-changed=${this._handleIconChange}
          ></ha-icon-picker>

          <ha-textfield
            .value=${config.name || ""}
            .label=${"Display name"}
            .placeholder=${defaultName}
            data-option-value=${value}
            @input=${this._handleNameChange}
          ></ha-textfield>

          <ha-color-picker
            .hass=${this.hass}
            .value=${config.color || ""}
            .label=${"Color"}
            data-option-value=${value}
            @value-changed=${this._handleColorChange}
          ></ha-color-picker>
        </div>
      </ha-card>
    `;
  }

  private _renderAvailableOptions() {
    if (!this.hass || !this.context?.entity_id) return nothing;

    const stateObj = this.hass.states[this.context.entity_id];
    if (!stateObj?.attributes.options) return nothing;

    const availableOptions = stateObj.attributes.options as string[];
    const configuredOptions = this._config?.options || [];
    const unaddedOptions = availableOptions.filter(
      (option) => !configuredOptions.includes(option)
    );

    if (unaddedOptions.length === 0) return nothing;

    return html`
      <div class="available-options">
        <h3>Available options</h3>
        <div class="options-grid">
          ${unaddedOptions.map(
            (option) => html`
              <div
                class="available-option"
                data-option-value=${option}
                @click=${this._handleAddOptionClick}
              >
                <span>${this.hass!.formatEntityState(stateObj, option)}</span>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }

    const data: SelectOptionsCardFeatureData = {
      ...this._config,
      customize_options: this._config.options !== undefined,
    };

    const schema = this._schema(
      data.customize_options,
      data.style || "dropdown"
    );

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${schema}
        .computeLabel=${this._computeLabelCallback}
        @value-changed=${this._valueChanged}
      ></ha-form>

      ${data.customize_options
        ? html`
            <div class="options-editor">
              <h3>Options configuration</h3>
              <div class="options-list">
                ${repeat(
                  this._getOptionItems(),
                  (item) => item.value,
                  (item, index) => this._renderOptionEditor(item, index)
                )}
              </div>
              ${this._renderAvailableOptions()}
            </div>
          `
        : nothing}
    `;
  }

  private _computeLabelCallback = (
    schema: SchemaUnion<ReturnType<typeof this._schema>>
  ) => {
    switch (schema.name) {
      case "style":
        return (
          this.hass!.localize(
            `ui.panel.lovelace.editor.features.types.select-options.style`
          ) || "Style"
        );
      case "customize_options":
        return (
          this.hass!.localize(
            `ui.panel.lovelace.editor.features.types.select-options.customize_options`
          ) || "Customize options"
        );
      default:
        return "";
    }
  };

  static readonly styles = css`
    .options-editor {
      margin-top: 16px;
    }

    .options-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
    }

    .option-card {
      padding: 12px;
      cursor: grab;
      transition: all 0.2s ease;
      border: 2px solid transparent;
    }

    .option-card:hover {
      border-color: var(--primary-color);
    }

    .option-card.drag-over {
      border-color: var(--primary-color);
      background-color: var(--primary-color-alpha-10);
    }

    .option-card:active {
      cursor: grabbing;
    }

    .option-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .drag-handle {
      color: var(--secondary-text-color);
      cursor: grab;
    }

    .option-preview {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .option-name {
      font-weight: 500;
    }

    .option-controls {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      align-items: end;
    }

    .available-options {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--divider-color);
    }

    .options-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px;
      margin-top: 8px;
    }

    .available-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .available-option:hover {
      background-color: var(--secondary-background-color);
      border-color: var(--primary-color);
    }

    h3 {
      margin: 0 0 8px 0;
      color: var(--primary-text-color);
      font-size: 14px;
      font-weight: 500;
    }

    ha-color-picker {
      --ha-color-picker-wheel-borderwidth: 2px;
      --ha-color-picker-wheel-bordercolor: var(--divider-color);
      --ha-color-picker-marker-borderwidth: 2px;
      --ha-color-picker-marker-bordercolor: var(--card-background-color);
    }

    ha-icon-picker {
      --ha-icon-picker-icon-color: var(--primary-text-color);
    }

    ha-textfield {
      --mdc-text-field-fill-color: var(--secondary-background-color);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-select-options-card-feature-editor": HuiSelectOptionsCardFeatureEditor;
  }
}
