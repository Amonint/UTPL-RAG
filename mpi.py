

from mpi4py import MPI

# Cambia este valor por tu nombre completo
estudiante = "Abraham"


def main() -> None:
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()
    processor_name = MPI.Get_processor_name()

    print(
        f"[Proceso {rank} de {size}] "
        f"Computadora: {processor_name} | "
        f"Estudiante: {estudiante}"
    )

    comm.Barrier()
    if rank == 0:
        print(f"Total de procesos MPI : {size}")


if __name__ == "__main__":
    main()
