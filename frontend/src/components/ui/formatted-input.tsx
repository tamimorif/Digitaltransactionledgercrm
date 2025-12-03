import * as React from 'react';
import { Input } from '@/src/components/ui/input';
import { formatAsUserTypes, parseFormattedNumber } from '@/src/lib/utils/number-format';

export interface FormattedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value?: string | number;
    onChange?: (value: string, numericValue: number) => void;
    allowDecimals?: boolean;
    allowNegative?: boolean;
}

/**
 * FormattedInput - A number input that automatically adds thousand separators
 * Usage:
 * <FormattedInput 
 *   value={amount} 
 *   onChange={(formatted, numeric) => setAmount(numeric.toString())}
 *   placeholder="0.00"
 * />
 */
const FormattedInput = React.forwardRef<HTMLInputElement, FormattedInputProps>(
    ({ value, onChange, allowDecimals = true, allowNegative = true, ...props }, ref) => {
        const [displayValue, setDisplayValue] = React.useState('');

        // Update display value when prop value changes
        React.useEffect(() => {
            if (value !== undefined && value !== null && value !== '') {
                const numValue = typeof value === 'string' ? parseFloat(value) : value;
                if (!isNaN(numValue)) {
                    setDisplayValue(formatAsUserTypes(numValue.toString(), allowDecimals));
                }
            } else {
                setDisplayValue('');
            }
        }, [value, allowDecimals]);

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

        return (
            <Input
                {...props}
                ref={ref}
                type="text"
                inputMode="decimal"
                value={displayValue}
                onChange={handleChange}
            />
        );
    }
);

FormattedInput.displayName = 'FormattedInput';

export { FormattedInput };
