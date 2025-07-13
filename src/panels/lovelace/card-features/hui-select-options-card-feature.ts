import { mdiFormatListBulleted } from "@mdi/js";
import type { PropertyValues, TemplateResult } from "lit";
import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators";
import { styleMap } from "lit/directives/style-map";
import { stopPropagation } from "../../../common/dom/stop_propagation";
import { computeDomain } from "../../../common/entity/compute_domain";
import "../../../components/ha-control-select";
import type { ControlSelectOption } from "../../../components/ha-control-select";
import "../../../components/ha-control-select-menu";
import type { HaControlSelectMenu } from "../../../components/ha-control-select-menu";
import "../../../components/ha-list-item";
import "../../../components/ha-icon";
import "../../../components/ha-svg-icon";
import { UNAVAILABLE } from "../../../data/entity";
import type { HomeAssistant } from "../../../types";
import type { LovelaceCardFeature, LovelaceCardFeatureEditor } from "../types";
import { cardFeatureStyles } from "./common/card-feature-styles";
import { filterModes } from "./common/filter-modes";
import type {
  SelectOptionsCardFeatureConfig,
  LovelaceCardFeatureContext,
} from "./types";

export const supportsSelectOptionsCardFeature = (
  hass: HomeAssistant,
  context: LovelaceCardFeatureContext
) => {
  const stateObj = context.entity_id
    ? hass.states[context.entity_id]
    : undefined;
  if (!stateObj) return false;
  const domain = computeDomain(stateObj.entity_id);
  return (
    (domain === "input_select" || domain === "select") &&
    stateObj.attributes.options &&
    Array.isArray(stateObj.attributes.options)
  );
};

@customElement("hui-select-options-card-feature")
class HuiSelectOptionsCardFeature
  extends LitElement
  implements LovelaceCardFeature
{
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public context?: LovelaceCardFeatureContext;

  @state() private _config?: SelectOptionsCardFeatureConfig;

  @state() _currentOption?: string;

  @query("ha-control-select-menu", true)
  private _haSelect?: HaControlSelectMenu;

  private get _stateObj() {
    if (!this.hass || !this.context || !this.context.entity_id) {
      return undefined;
    }
    return this.hass.states[this.context.entity_id!];
  }

  static getStubConfig(): SelectOptionsCardFeatureConfig {
    return {
      type: "select-options",
      style: "dropdown",
    };
  }

  public static async getConfigElement(): Promise<LovelaceCardFeatureEditor> {
    await import(
      "../editor/config-elements/hui-select-options-card-feature-editor"
    );
    return document.createElement("hui-select-options-card-feature-editor");
  }

  public setConfig(config: SelectOptionsCardFeatureConfig): void {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = config;
  }

  protected willUpdate(changedProp: PropertyValues): void {
    super.willUpdate(changedProp);
    if (
      (changedProp.has("hass") || changedProp.has("context")) &&
      this._stateObj
    ) {
      const oldHass = changedProp.get("hass") as HomeAssistant | undefined;
      const oldStateObj = oldHass?.states[this.context!.entity_id!];
      if (oldStateObj !== this._stateObj) {
        this._currentOption = this._stateObj.state;
      }
    }
  }

  protected updated(changedProps: PropertyValues) {
    super.updated(changedProps);
    if (this._haSelect && changedProps.has("hass")) {
      const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
      if (
        this.hass &&
        this.hass.formatEntityState !== oldHass?.formatEntityState
      ) {
        this._haSelect.layoutOptions();
      }
    }
  }

  private async _valueChanged(ev: CustomEvent) {
    const option =
      (ev.detail as any).value ?? ((ev.target as any).value as string);

    const oldOption = this._stateObj!.state;

    if (option === oldOption) return;

    this._currentOption = option;

    try {
      await this._setOption(option);
    } catch (_err) {
      this._currentOption = oldOption;
    }
  }

  private async _setOption(option: string) {
    const domain = computeDomain(this._stateObj!.entity_id);
    const service =
      domain === "input_select" ? "select_option" : "select_option";

    await this.hass!.callService(domain, service, {
      entity_id: this._stateObj!.entity_id,
      option: option,
    });
  }

  private _getOptionIcon(option: string): string | undefined {
    return this._config?.option_config?.[option]?.icon;
  }

  private _getOptionName(option: string): string {
    return (
      this._config?.option_config?.[option]?.name ||
      this.hass!.formatEntityState(this._stateObj!, option)
    );
  }

  private _getOptionColor(option: string): string | undefined {
    return this._config?.option_config?.[option]?.color;
  }

  private _isOptionDisabled(option: string): boolean {
    return this._config?.option_config?.[option]?.disabled || false;
  }

  protected render(): TemplateResult | null {
    if (
      !this._config ||
      !this.hass ||
      !this.context ||
      !this._stateObj ||
      !supportsSelectOptionsCardFeature(this.hass, this.context)
    ) {
      return null;
    }

    const stateObj = this._stateObj;
    const availableOptions = stateObj.attributes.options || [];

    const filteredOptions = filterModes(
      availableOptions,
      this._config!.options
    );

    const options = filteredOptions
      .filter((option) => !this._isOptionDisabled(option))
      .map<ControlSelectOption>((option) => {
        const icon = this._getOptionIcon(option);
        const name = this._getOptionName(option);

        return {
          value: option,
          label: name,
          icon: icon
            ? html`<ha-icon slot="graphic" .icon=${icon}></ha-icon>`
            : this._config?.style === "icons"
              ? html`<span slot="graphic">${name}</span>`
              : undefined,
        };
      });

    if (this._config.style === "icons") {
      return html`
        <ha-control-select
          .options=${options}
          .value=${this._currentOption || ""}
          @value-changed=${this._valueChanged}
          hide-label
          .ariaLabel=${this.hass!.formatEntityAttributeName(
            stateObj,
            "options"
          )}
          .disabled=${this._stateObj!.state === UNAVAILABLE}
          style=${styleMap({
            "--control-select-color": this._currentOption
              ? this._getOptionColor(this._currentOption) || ""
              : "",
          })}
        >
        </ha-control-select>
      `;
    }

    const currentIcon = this._currentOption
      ? this._getOptionIcon(this._currentOption)
      : undefined;

    return html`
      <ha-control-select-menu
        show-arrow
        hide-label
        .label=${this.hass!.formatEntityAttributeName(stateObj, "options")}
        .value=${this._currentOption || ""}
        .disabled=${this._stateObj.state === UNAVAILABLE}
        fixedMenuPosition
        naturalMenuWidth
        @selected=${this._valueChanged}
        @closed=${stopPropagation}
        style=${styleMap({
          "--control-select-menu-color": this._currentOption
            ? this._getOptionColor(this._currentOption) || ""
            : "",
        })}
      >
        ${currentIcon
          ? html`<ha-icon
              slot="icon"
              .icon=${currentIcon}
              style=${styleMap({
                color: this._currentOption
                  ? this._getOptionColor(this._currentOption) || ""
                  : "",
              })}
            ></ha-icon>`
          : html`<ha-svg-icon
              slot="icon"
              .path=${mdiFormatListBulleted}
            ></ha-svg-icon>`}
        ${options.map((option) => {
          const optionIcon = this._getOptionIcon(option.value);
          const optionName = this._getOptionName(option.value);
          const optionColor = this._getOptionColor(option.value);

          return html`
            <ha-list-item .value=${option.value} graphic="icon">
              ${optionIcon
                ? html`<ha-icon
                    slot="graphic"
                    .icon=${optionIcon}
                    style=${styleMap({
                      color: optionColor || "",
                    })}
                  ></ha-icon>`
                : html`<ha-svg-icon
                    slot="graphic"
                    .path=${mdiFormatListBulleted}
                  ></ha-svg-icon>`}
              ${optionName}
            </ha-list-item>
          `;
        })}
      </ha-control-select-menu>
    `;
  }

  static get styles() {
    return cardFeatureStyles;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-select-options-card-feature": HuiSelectOptionsCardFeature;
  }
}
