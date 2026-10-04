"use client";
import { allowNavigation, RouteLink } from "./navigation";
import { createContext, useContext, useId, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  X,
  CaretDown,
  Check,
  HouseLine,
  CheckCircle,
  Circle,
} from "@phosphor-icons/react";
import { t } from "../lib/i18n.mjs";
import { meaningful } from "../lib/domain.mjs";
const FieldStatusContext = createContext(null);
const filled = (value) =>
  meaningful(
    value,
    typeof value === "number"
      ? "number"
      : typeof value === "boolean"
        ? "boolean"
        : "text",
  );
export function FieldStatusScope({ locale, children }) {
  return (
    <FieldStatusContext.Provider value={locale}>
      {children}
    </FieldStatusContext.Provider>
  );
}
export function FieldStatus({ value, locale, ...props }) {
  const present = filled(value);
  return (
    <span
      className={`field-status ${present ? "is-filled" : "is-empty"}`}
      {...props}
    >
      {present ? (
        <CheckCircle size={14} aria-hidden="true" />
      ) : (
        <Circle size={14} aria-hidden="true" />
      )}
      {t(locale, present ? "fieldFilled" : "fieldEmpty")}
    </span>
  );
}
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function IconButton({ label, children, ...props }) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
export function Field({
  label,
  type = "text",
  value,
  onChange,
  hint,
  className = "",
  ...props
}) {
  const id = useId(),
    locale = useContext(FieldStatusContext);
  const description =
    [locale && `${id}-status`, hint && `${id}-hint`, props["aria-describedby"]]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <label
      className={`field ${className}`}
      htmlFor={id}
      data-field-state={
        locale ? (filled(value) ? "filled" : "empty") : undefined
      }
    >
      <span className="field-label">
        {label}
        {locale && (
          <FieldStatus
            id={`${id}-status`}
            value={value}
            locale={locale}
            aria-hidden="true"
          />
        )}
      </span>
      {type === "textarea" ? (
        <textarea
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          {...props}
          aria-label={props["aria-label"] || label}
          aria-describedby={description}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              type === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
          {...props}
          aria-label={props["aria-label"] || label}
          aria-describedby={description}
        />
      )}{" "}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}
export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  className = "",
}) {
  const id = useId(),
    locale = useContext(FieldStatusContext);
  return (
    <div
      className={`field ${className}`}
      data-field-state={
        locale ? (filled(value) ? "filled" : "empty") : undefined
      }
    >
      {locale ? (
        <div className="field-label">
          <label htmlFor={id}>{label}</label>
          <FieldStatus id={`${id}-status`} value={value} locale={locale} />
        </div>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      <SelectPrimitive.Root
        value={value || "_none"}
        onValueChange={(v) => onChange(v === "_none" ? "" : v)}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          id={id}
          className="select-trigger"
          aria-label={label}
          aria-describedby={locale ? `${id}-status` : undefined}
        >
          <SelectPrimitive.Value />
          <CaretDown size={16} />
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="select-content"
            position="popper"
            sideOffset={5}
          >
            <SelectPrimitive.Viewport>
              {options.map((option) => {
                const o =
                  typeof option === "string"
                    ? { value: option, label: option }
                    : option;
                return (
                  <SelectPrimitive.Item
                    value={o.value || "_none"}
                    key={o.value}
                    className="select-item"
                    disabled={o.disabled}
                  >
                    <SelectPrimitive.ItemText>
                      {o.label}
                    </SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator>
                      <Check size={15} />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                );
              })}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
export function BooleanField({ label, value, onChange, options }) {
  const id = useId(),
    locale = useContext(FieldStatusContext);
  return (
    <div
      className="field boolean-field"
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={locale ? `${id}-status` : undefined}
      data-field-state={
        locale ? (filled(value) ? "filled" : "empty") : undefined
      }
    >
      <div className="field-label">
        <span id={`${id}-label`}>{label}</span>
        {locale && (
          <FieldStatus id={`${id}-status`} value={value} locale={locale} />
        )}
      </div>
      <div className="boolean-choices">
        {options.map((option) => (
          <Toggle
            key={String(option.value)}
            label={option.label}
            checked={value === option.value}
            onChange={(checked) => onChange(checked ? option.value : null)}
          />
        ))}
      </div>
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  checkboxOnly = false,
}) {
  const Container = checkboxOnly ? "div" : "label";
  return (
    <Container
      className={`toggle-label${checkboxOnly ? " checkbox-only" : ""}`}
    >
      <input
        type="checkbox"
        aria-label={checkboxOnly ? label : undefined}
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{label}</span>
    </Container>
  );
}
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  locale = "en",
  wide = false,
  onOpenAutoFocus,
}) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(value) => {
        if (
          !value &&
          allowNavigation(document.querySelector('[role="dialog"]') || document)
        )
          onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          className={`dialog ${wide ? "wide" : ""}`}
          onOpenAutoFocus={onOpenAutoFocus}
          aria-describedby={description ? "dialog-description" : undefined}
        >
          <div className="dialog-heading">
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label={t(locale, "close")}>
                <X size={22} />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          {description && (
            <DialogPrimitive.Description id="dialog-description">
              {description}
            </DialogPrimitive.Description>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function Menu({ label, trigger, items, className = "", heading }) {
  const openingDialog = useRef(false);
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button className={`menu-trigger ${className}`} aria-label={label}>
          {trigger}
          <CaretDown size={16} />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="dropdown-content"
          align="end"
          sideOffset={8}
          onCloseAutoFocus={(event) => {
            if (openingDialog.current) event.preventDefault();
            openingDialog.current = false;
          }}
        >
          {heading && (
            <>
              <Dropdown.Label className="menu-heading">
                {heading}
              </Dropdown.Label>
              <Dropdown.Separator className="menu-separator" />
            </>
          )}
          {items.map((item, i) =>
            item.separator ? (
              <Dropdown.Separator className="menu-separator" key={i} />
            ) : item.patch ? (
              <Dropdown.Item asChild key={i} className="dropdown-item">
                <RouteLink patch={item.patch}>
                  {item.icon}
                  {item.label}
                </RouteLink>
              </Dropdown.Item>
            ) : (
              <Dropdown.Item
                className="dropdown-item"
                key={i}
                onSelect={() => {
                  openingDialog.current = Boolean(item.opensDialog);
                  item.onClick?.();
                }}
                disabled={item.disabled}
              >
                {item.icon}
                {item.label}
              </Dropdown.Item>
            ),
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
export function Empty({ title, description, children, icon }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        {icon || <HouseLine size={40} weight="light" />}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function ErrorNotice({ children }) {
  return children ? (
    <div className="error-notice" role="alert">
      {children}
    </div>
  ) : null;
}
export function Chip({ children, tone = "" }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}
export function Loading({ locale }) {
  return (
    <div className="loading" aria-label={t(locale, "loading")}>
      <div className="skeleton title" />
      <div className="skeleton line" />
      {[0, 1, 2].map((i) => (
        <div className="skeleton row" key={i} />
      ))}
    </div>
  );
}
