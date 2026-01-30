import React, { CSSProperties, forwardRef } from 'react'

type MaybeNode = React.ReactNode | React.ReactNode[]

export type WidgetHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  icon: MaybeNode
  title: MaybeNode
  subtitle?: MaybeNode
  actions?: MaybeNode
  titleStyle?: CSSProperties
  subtitleStyle?: CSSProperties
  iconContainerClassName?: string
  textContainerClassName?: string
  titleClassName?: string
  subtitleClassName?: string
  actionsContainerClassName?: string
}

const combineClassNames = (...values: Array<string | undefined | null | false>) =>
  values.filter(Boolean).join(' ')

export const WidgetHeader = forwardRef<HTMLDivElement, WidgetHeaderProps>(function WidgetHeader(
  {
    icon,
    title,
    subtitle,
    actions,
    className,
    iconContainerClassName,
    textContainerClassName,
    titleStyle,
    subtitleStyle,
    titleClassName,
    subtitleClassName,
    actionsContainerClassName,
    ...rest
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={combineClassNames(
        'flex items-center justify-between bg-white/5 backdrop-blur-sm border-b border-white/10',
        'gap-1.5 px-4 py-2.5',
        className,
      )}
      {...rest}
    >
      <div className={combineClassNames('flex items-center flex-1 min-w-0', 'gap-2 mt-1')}>
        <span
          className={combineClassNames(
            'flex items-center justify-center text-white flex-shrink-0 leading-none',
            iconContainerClassName,
          )}
        >
          {icon}
        </span>
        <div className={combineClassNames('flex flex-col text-white flex-1 min-w-0', textContainerClassName)}>
          <span
            className={combineClassNames(
              'text-[16px] font-semibold',
              titleClassName,
            )}
            style={titleStyle}
          >
            {title}
          </span>
          {/* {subtitle ? (
            <span
              className={combineClassNames(
                'text-xs uppercase tracking-[0.25em] text-white/50',
                subtitleClassName,
              )}
              style={subtitleStyle}
            >
              {subtitle}
            </span>
          ) : null} */}
        </div>
      </div>
      {actions ? (
        <div
          className={combineClassNames(
            'flex items-center flex-shrink-0',
            'gap-1.5',
            actionsContainerClassName,
          )}
          data-widget-header-actions="true"
        >
          {actions}
        </div>
      ) : null}
    </div>
  )
})