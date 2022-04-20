export class StringUtils {
    public static parsePointFromParam(param: string, separator: string = ","): { x: number; y: number } | undefined {
        const values = param.split(separator).map((val) => parseInt(val));
        if (values.length !== 2) {
            return;
        }
        if (isNaN(values[0]) || isNaN(values[1])) {
            return;
        }
        return { x: values[0], y: values[1] };
    }

    /**
     * Computes a "short URL" hash of the string passed in parameter.
     */
    public static shortHash = function (s: string): string {
        let hash = 0;
        const strLength = s.length;
        if (strLength === 0) {
            return "";
        }
        for (let i = 0; i < strLength; i++) {
            const c = s.charCodeAt(i);
            hash = (hash << 5) - hash + c;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    };
}
