import * as React from 'react';
import { Input } from '@/src/components/ui/input';
import { formatAsUserTypes, parseFormattedNumber, formatCurrency, getCurrencyDecimals } from '@/src/lib/utils/number-format';


export interface FormattedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value?: string | number;
    onChange?: (value: string, numericValue: number) => void;
    allowDecimals?: boolean | number;
    allowNegative?: boolean;
    currency?: string;
}



/**
 * FormattedInput - A number input that automatically adds thousand separators
 * Usage:
 * <FormattedInput 
 *   value={amount} 
 *   onChange={(formatted, numeric) => setAmount(numeric.toString())}
 *   currency="USD"
 * />
 */
const FormattedInput = React.forwardRef<HTMLInputElement, FormattedInputProps>(
    ({ value, onChange, allowDecimals: customAllowDecimals, allowNegative = true, currency, ...props }, ref) => {
        const [displayValue, setDisplayValue] = React.useState('');

        // Determine decimal settings based on currency or custom prop
        let decimals = 2; // Default
        if (currency) {
            decimals = getCurrencyDecimals(currency);
        } else if (typeof customAllowDecimals === 'number') {
            decimals = customAllowDecimals;
        } else if (customAllowDecimals === false) {
            decimals = 0;
        }

        const allowDecimals = decimals > 0 ? decimals : false;


        // Update display value when prop value changes
        React.useEffect(() => {
            if (value !== undefined && value !== null && value !== '') {
                const numValue = typeof value === 'string' ? parseFloat(value) : value;
                const currentDisplayNum = parseFormattedNumber(displayValue);

                // Only update display if the numeric value actually changed (or initially empty)
                // This prevents stripping trailing decimals/zeros while typing
                if (!isNaN(numValue) && (numValue !== currentDisplayNum || displayValue === '')) {
                    setDisplayValue(formatAsUserTypes(numValue.toString(), allowDecimals));
                }
            } else {
                setDisplayValue('');
            }
        }, [value, allowDecimals]); // Removed displayValue from deps to avoid loop, logic relies on current closure or ref


        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            let inputValue = e.target.value;

            // Handle negative numbers
            if (!allowNegative && inputValue.startsWith('-')) {
                inputValue = inputValue.substring(1);
            }

            // Format the value
            const formatted = formatAsUserTypes(inputValue, allowDecimals);
            setDisplayValue(formatted);

            // Call onChange with both formatted string and numeric value
            if (onChange) {
                const numericValue = parseFormattedNumber(formatted);
                onChange(formatted, numericValue);
            }
        };

        const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
            if (displayValue && displayValue !== '-' && displayValue !== '.') {
                const numericValue = parseFormattedNumber(displayValue);
                // Enforce final currency format on blur (e.g. .00)
                const finalFormat = formatCurrency(numericValue, currency);
                setDisplayValue(finalFormat);
            }
            if (props.onBlur) {
                props.onBlur(e);
            }
        };

        return (
            <Input
                {...props}
                ref={ref}
                type="text"
                inputMode="decimal"
                value={displayValue}
                onChange={handleChange}
                onBlur={handleBlur}
            />
        );
    }
);


FormattedInput.displayName = 'FormattedInput';

export { FormattedInput };
