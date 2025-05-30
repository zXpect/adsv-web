class WorkerFilter {  
    constructor() {  
        this.allWorkers = [];  
        this.filteredWorkers = [];  
        this.currentFilter = 'todos';  
        this.setupFilterButtons();  
    }  
  
    setupFilterButtons() {  
        const filterButtons = document.querySelectorAll('[data-filter]');  
          
        filterButtons.forEach(button => {  
            button.addEventListener('click', () => {  
                this.updateFilterUI(button);  
                this.applyFilter(button.getAttribute('data-filter'));  
            });  
        });  
    }  
  
    updateFilterUI(activeButton) {  
        const filterButtons = document.querySelectorAll('[data-filter]');  
          
        filterButtons.forEach(btn => {  
            btn.classList.remove('active', 'bg-primary', 'text-white');  
            btn.classList.add('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-200');  
        });  
  
        activeButton.classList.remove('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-200');  
        activeButton.classList.add('active', 'bg-primary', 'text-white');  
    }  
  
    applyFilter(filterType) {  
        this.currentFilter = filterType;  
          
        if (filterType === 'todos') {  
            this.filteredWorkers = this.allWorkers;  
        } else {  
            this.filteredWorkers = this.allWorkers.filter(worker => {  
                const workerType = (worker.work || worker.typeOfWork || '').toLowerCase();  
                return workerType === filterType.toLowerCase();  
            });  
        }  
  
        this.displayFilteredWorkers();  
    }  
  
    setWorkers(workers) {  
        this.allWorkers = workers;  
        this.applyFilter(this.currentFilter);  
    }  
  
    displayFilteredWorkers() {  
        // Emitir evento personalizado para que otros componentes escuchen  
        const event = new CustomEvent('workersFiltered', {  
            detail: { workers: this.filteredWorkers }  
        });  
        document.dispatchEvent(event);  
    }  
}