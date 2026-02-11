import pandas as pd
import logging
from core.chart_mapper import ChartMapper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def main():
    # Initialize mapper
    mapper = ChartMapper()
    
    try:
        # Load standard CoA and user overrides
        mapper.load_standard_coa('data/input/standard_coa.csv')
        mapper.load_user_overrides('data/input/user_overrides.csv')
        
        # Load GL data
        gl_data = pd.read_csv('data/input/gl_data.csv')
        
        # Map accounts
        mapped_gl, unmapped = mapper.map_gl_data(gl_data)
        
        # Save results
        mapped_gl.to_csv('data/output/mapped_gl.csv', index=False)
        mapper.save_unmapped_report(unmapped, 'data/output/unmapped_accounts.csv')
        
        # Print summary
        print("\nMapping Summary:")
        print(f"Total accounts processed: {len(mapped_gl)}")
        print(f"Unmapped accounts: {len(unmapped)}")
        
        if not unmapped.empty:
            print("\nUnmapped Accounts:")
            for _, row in unmapped.iterrows():
                print(f"- {row['account_name']} ({row['account_number']})")
        
    except Exception as e:
        logging.error(f"Error during mapping: {str(e)}")
        raise

if __name__ == '__main__':
    main() 